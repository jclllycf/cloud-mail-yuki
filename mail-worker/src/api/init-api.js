import app from '../hono/hono';
import { dbInit } from '../init/init';

// Database initialization uses a POST with a bearer token, never a URL secret.
app.post('/init', (c) => {
	return dbInit.init(c);
})
