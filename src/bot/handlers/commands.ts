import type { CommandContext, Context } from 'grammy';
import type { AureliaConfig } from '../../config/schema.js';
import { logger } from '../../utils/logger.js';
import { requestDeviceCode, pollForToken, saveTokensToConfig, isTokenExpired } from '../../kimi/auth.js';

export function createCommandHandlers(config: AureliaConfig) {
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
        `/auth_status — Check Kimi authentication status\n\n` +
        `You can also send any text message and I will echo it back.\n` +
        `In the future, messages will be translated by Kimi and executed via ADE.`,
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

  return { handleStart, handleHelp, handleStatus, handleAuth, handleAuthStatus };
}
