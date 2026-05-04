import { json, type RequestHandler } from '@sveltejs/kit';
import { CMSValidationError, saveCmsDocument } from '$lib/server/cms/documents';
import { createDocument, listDocuments } from '$lib/server/queries/documents';

async function readJson(request: Request) {
	try {
		return await request.json();
	} catch {
		throw new CMSValidationError('Expected document payload as JSON.');
	}
}

function databaseError(message: string, error: unknown) {
	console.error(message, error);
	return json(
		{ message: 'CMS database is unavailable. Check DATABASE_URL and run bun run db:migrate.' },
		{ status: 500 }
	);
}

export const GET: RequestHandler = async () => {
	try {
		const documents = await listDocuments();
		return json({ documents });
	} catch (error) {
		return databaseError('Document list failed', error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const document = await saveCmsDocument(null, await readJson(request), {
			createDocument,
			updateDocument: async () => null
		});

		return json({ document }, { status: 201 });
	} catch (error) {
		if (error instanceof CMSValidationError) {
			return json({ message: error.message }, { status: 400 });
		}

		return databaseError('Document create failed', error);
	}
};
