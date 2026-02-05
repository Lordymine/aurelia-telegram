import type { CommandContext, Context } from 'grammy';
import type { AureliaConfig } from '../../config/schema.js';
import { logger } from '../../utils/logger.js';
import { requestDeviceCode, pollForToken, saveTokensToConfig, isTokenExpired } from '../../kimi/auth.js';
import type { JobManager } from '../../bridge/job-manager.js';
import type { SessionManager } from '../../session/manager.js';

export function createCommandHandlers(config: AureliaConfig, jobManager?: JobManager, sessionManager?: SessionManager) {
  async function handleStart(ctx: CommandContext<Context>): Promise<void> {
    logger.info({ userId: ctx.from?.id }, '/start command');
    const name = ctx.from?.first_name ?? 'there';
    await ctx.reply(
      `Welcome, ${name}! I'm Aurelia, your Telegram gateway to the AIOS ADE.\n\n` +
        `Project: ${config.projectPath}\n` +
        `Mode: ${config.deployMode}\n\n` +
        `Use /help to see available commands.\n` +
        `Use /auth to authenticate with Kimi for Coding.`,
    );
  }

  async function handleHelp(ctx: CommandContext<Context>): Promise<void> {
    logger.info({ userId: ctx.from?.id }, '/help command');
    await ctx.reply(
      `Available commands:\n\n` +
        `/start — Welcome message and bot info\n` +
        `/help — Show this help message\n` +
        `/status — Show bot status and connections\n` +
        `/auth — Authenticate with Kimi for Coding\n` +
        `/auth_status — Check Kimi authentication status\n` +
        `/jobs — List active and recent jobs\n` +
        `/cancel — Cancel the current running job\n` +
        `/switch_project — Switch active project\n` +
        `/whoami — Show your session info\n\n` +
        `Send any text message to interact with ADE via Kimi translation.`,
    );
  }

  async function handleStatus(ctx: CommandContext<Context>): Promise<void> {
    logger.info({ userId: ctx.from?.id }, '/status command');
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

    const kimiStatus = config.kimi.accessToken
      ? isTokenExpired(config.kimi.expiresAt)
        ? 'expired (use /auth)'
        : 'authenticated'
      : 'not configured (use /auth)';

    await ctx.reply(
      `Bot Status:\n\n` +
        `Uptime: ${uptimeStr}\n` +
        `Deploy mode: ${config.deployMode}\n` +
        `Project: ${config.projectPath}\n` +
        `Allowed users: ${config.allowedUsers.length}\n` +
        `Kimi: ${kimiStatus}`,
    );
  }

  async function handleAuth(ctx: CommandContext<Context>): Promise<void> {
    logger.info({ userId: ctx.from?.id }, '/auth command');

    try {
      await ctx.reply('Requesting device code from Kimi...');
      const deviceCode = await requestDeviceCode();

      await ctx.reply(
        `🔐 Kimi Authentication\n\n` +
          `Go to: ${deviceCode.verification_uri}\n` +
          `Enter code: ${deviceCode.user_code}\n\n` +
          `Waiting for authorization... (expires in ${Math.floor(deviceCode.expires_in / 60)} minutes)`,
      );

      const result = await pollForToken(deviceCode.device_code, deviceCode.interval, deviceCode.expires_in, () => {
        logger.debug({ userId: ctx.from?.id }, 'Auth polling: authorization pending');
      });

      if (result.success) {
        await saveTokensToConfig(result.tokens);
        config.kimi.accessToken = result.tokens.access_token;
        config.kimi.refreshToken = result.tokens.refresh_token;
        config.kimi.expiresAt = Date.now() + result.tokens.expires_in * 1000;
        await ctx.reply('✅ Successfully authenticated with Kimi! You can now use natural language commands.');
      } else {
        await ctx.reply(`❌ Authentication failed: ${result.description ?? result.error}`);
      }
    } catch (err) {
      logger.error({ err, userId: ctx.from?.id }, 'Auth error');
      await ctx.reply('❌ Failed to start authentication. Please try again later.');
    }
  }

  async function handleAuthStatus(ctx: CommandContext<Context>): Promise<void> {
    logger.info({ userId: ctx.from?.id }, '/auth_status command');

    if (!config.kimi.accessToken) {
      await ctx.reply('Kimi: Not authenticated.\nUse /auth to authenticate with your Kimi for Coding subscription.');
      return;
    }

    if (isTokenExpired(config.kimi.expiresAt)) {
      await ctx.reply('Kimi: Token expired.\nUse /auth to re-authenticate.');
      return;
    }

    const expiresAt = config.kimi.expiresAt;
    const expiresIn = expiresAt ? Math.floor((expiresAt - Date.now()) / 60000) : 0;
    await ctx.reply(`Kimi: Authenticated ✅\nToken expires in: ${expiresIn} minutes`);
  }

  async function handleJobs(ctx: CommandContext<Context>): Promise<void> {
    logger.info({ userId: ctx.from?.id }, '/jobs command');

    if (!jobManager) {
      await ctx.reply('Job manager not available.');
      return;
    }

    const userId = ctx.from?.id;
    const active = jobManager.getActiveJobs(userId);
    const recent = jobManager.getRecentJobs(userId, 5);

    if (active.length === 0 && recent.length === 0) {
      await ctx.reply('No jobs found.');
      return;
    }

    let text = '';
    if (active.length > 0) {
      text += 'Active jobs:\n';
      for (const job of active) {
        text += `• ${job.id.slice(0, 8)} — ${job.status} — ${job.command.slice(0, 50)}\n`;
      }
      text += '\n';
    }

    if (recent.length > 0) {
      text += 'Recent jobs:\n';
      for (const job of recent) {
        const duration = job.completedAt && job.startedAt
          ? `${Math.round((job.completedAt - job.startedAt) / 1000)}s`
          : '-';
        text += `• ${job.id.slice(0, 8)} — ${job.status} — ${duration}\n`;
      }
    }

    await ctx.reply(text.trim());
  }

  async function handleCancel(ctx: CommandContext<Context>): Promise<void> {
    logger.info({ userId: ctx.from?.id }, '/cancel command');

    if (!jobManager) {
      await ctx.reply('Job manager not available.');
      return;
    }

    const userId = ctx.from?.id;
    const active = jobManager.getActiveJobs(userId);

    if (active.length === 0) {
      await ctx.reply('No active jobs to cancel.');
      return;
    }

    // Cancel the most recent active job
    const job = active[0]!;
    const cancelled = jobManager.cancelJob(job.id);

    if (cancelled) {
      await ctx.reply(`Cancelled job ${job.id.slice(0, 8)}.`);
    } else {
      await ctx.reply(`Could not cancel job ${job.id.slice(0, 8)}.`);
    }
  }

  async function handleSwitchProject(ctx: CommandContext<Context>): Promise<void> {
    logger.info({ userId: ctx.from?.id }, '/switch_project command');

    if (!sessionManager) {
      await ctx.reply('Session manager not available.');
      return;
    }

    const text = ctx.message?.text ?? '';
    const path = text.replace(/^\/switch_project\s*/, '').trim();

    if (!path) {
      await ctx.reply('Usage: /switch_project /path/to/project');
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    sessionManager.switchProject(userId, path);
    await ctx.reply(`Switched active project to: ${path}`);
  }

  async function handleWhoami(ctx: CommandContext<Context>): Promise<void> {
    logger.info({ userId: ctx.from?.id }, '/whoami command');

    const userId = ctx.from?.id;
    if (!userId) return;

    if (!sessionManager) {
      await ctx.reply(`User ID: ${userId}\nName: ${ctx.from?.first_name ?? 'Unknown'}`);
      return;
    }

    const session = sessionManager.getOrCreateSession(userId);
    const uptimeMs = Date.now() - session.createdAt;
    const uptimeMin = Math.floor(uptimeMs / 60000);

    await ctx.reply(
      `User: ${ctx.from?.first_name ?? 'Unknown'}\n` +
        `ID: ${userId}\n` +
        `Project: ${session.activeProject}\n` +
        `Authenticated: ${session.authenticated ? 'Yes' : 'No'}\n` +
        `History: ${session.conversationHistory.length} messages\n` +
        `Active job: ${session.activeJobId ?? 'None'}\n` +
        `Session age: ${uptimeMin} minutes`,
    );
  }

  return { handleStart, handleHelp, handleStatus, handleAuth, handleAuthStatus, handleJobs, handleCancel, handleSwitchProject, handleWhoami };
}
