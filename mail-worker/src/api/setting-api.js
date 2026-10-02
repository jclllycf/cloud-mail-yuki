import app from '../hono/hono';
import result from '../model/result';
import settingService from '../service/setting-service';
import userContext from "../security/user-context";
import telegramService from '../service/telegram-service';

app.put('/setting/set', async (c) => {
	const body = await c.req.json();
	await settingService.set(c, body);
	if (body.customDomain !== undefined || body.tgBotToken !== undefined) {
		try {
			await telegramService.setupWebhook(c);
		} catch (e) {
			console.error('Auto setup Telegram Webhook failed:', e);
		}
	}
	return c.json(result.ok());
});


app.get('/setting/query', async (c) => {
	const setting = await settingService.get(c);
	return c.json(result.ok(setting));
});

app.get('/setting/websiteConfig', async (c) => {
	const setting = await settingService.websiteConfig(c);
	return c.json(result.ok(setting));
})

app.put('/setting/setBackground', async (c) => {
	const key = await settingService.setBackground(c, await c.req.json());
	return c.json(result.ok(key));
});

app.delete('/setting/deleteBackground', async (c) => {
	await settingService.deleteBackground(c);
	return c.json(result.ok());
});

app.put('/setting/setBlacklist', async (c) => {
	const setting = await settingService.setBlacklist(c, await c.req.json());
	return c.json(result.ok(setting));
})

