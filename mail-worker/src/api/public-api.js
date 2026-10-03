import app from '../hono/hono';
import result from '../model/result';
import publicService from '../service/public-service';

app.post('/public/genToken', async (c) => {
	const data = await publicService.genToken(c, await c.req.json());
	return c.json(result.ok(data));
});

app.post('/public/emailList', async (c) => {
	const list = await publicService.emailList(c, await c.req.json());
	return c.json(result.ok(list));
});

app.get('/public/email/:emailId', async (c) => {
	const emailId = c.req.param('emailId');
	const data = await publicService.getEmailDetail(c, emailId);
	return c.json(result.ok(data));
});

app.post('/public/send', async (c) => {
	const data = await publicService.sendEmail(c, await c.req.json());
	return c.json(result.ok(data));
});

app.delete('/public/email/:emailId', async (c) => {
	const emailId = c.req.param('emailId');
	const data = await publicService.deleteEmail(c, emailId);
	return c.json(result.ok(data));
});

app.post('/public/addUser', async (c) => {
	await publicService.addUser(c, await c.req.json());
	return c.json(result.ok());
});
