import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
//import { NoteEditor, action } from './__note-editor.tsx'
import { JobEditor, action } from './__job-editor.tsx'

export { action }

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const job = await prisma.job.findFirst({
		select: {
			id: true,
			name: true,
			status: true,
			description: true,
			url: true,
			questions: true,
			source: true,
			updatedAt: true,
		},
		where: {
			id: params.jobId,
			ownerId: userId,
		},
	})
	invariantResponse(job, 'Not found', { status: 404 })
	const note = await prisma.note.findFirst({
		select: {
			id: true,
			title: true,
			content: true,
			images: {
				select: {
					id: true,
					altText: true,
				},
			},
		},
		where: {
			id: params.noteId,
			ownerId: userId,
		},
	})
	invariantResponse(note, 'Not found', { status: 404 })
	return json({ note: note, job: job })
}

//TODO fix
export default function JobEdit() {
	const data = useLoaderData<typeof loader>()
	console.log('data from edit', data)

	return <JobEditor note={data.note} job={data.job}/>
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No note with the id "{params.noteId}" exists</p>
				),
			}}
		/>
	)
}
