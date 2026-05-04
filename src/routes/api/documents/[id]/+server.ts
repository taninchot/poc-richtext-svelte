import { json, type RequestHandler } from '@sveltejs/kit';
import { CMSValidationError, saveCmsDocument } from '$lib/server/cms/documents';
import {
	createDocument,
	deleteDocument,
	getDocumentById,
	updateDocument
} from '$lib/server/queries/documents';

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

function documentId(params: Partial<Record<string, string>>) {
	return params.id;
}

export const GET: RequestHandler = async ({ params }) => {
	const id = documentId(params);

	if (!id) {
		return json({ message: 'Document id is required.' }, { status: 400 });
	}

	try {
		const document = await getDocumentById(id);

		if (!document) {
			return json({ message: 'Document not found.' }, { status: 404 });
		}

		return json({ document });
	} catch (error) {
		return databaseError('Document read failed', error);
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = documentId(params);

	if (!id) {
		return json({ message: 'Document id is required.' }, { status: 400 });
	}

	try {
		const document = await saveCmsDocument(id, await readJson(request), {
			createDocument,
			updateDocument
		});

		if (!document) {
			return json({ message: 'Document not found.' }, { status: 404 });
		}

		return json({ document });
	} catch (error) {
		if (error instanceof CMSValidationError) {
			return json({ message: error.message }, { status: 400 });
		}

		return databaseError('Document update failed', error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = documentId(params);

	if (!id) {
		return json({ message: 'Document id is required.' }, { status: 400 });
	}

	try {
		await deleteDocument(id);
		return json({ ok: true });
	} catch (error) {
		return databaseError('Document delete failed', error);
	}
};
