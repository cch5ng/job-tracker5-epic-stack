import { useForm } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import {
	json,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
} from '@remix-run/node'
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	type MetaFunction,
} from '@remix-run/react'
import { formatDistanceToNow } from 'date-fns'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.tsx'
import { ErrorList } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { getNoteImgSrc, useIsPending } from '#app/utils/misc.tsx'
import {
	requireUserWithPermission,
	userHasPermission,
} from '#app/utils/permissions.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { useOptionalUser } from '#app/utils/user.ts'
import { type loader as notesLoader } from './notes.tsx'

export async function loader({ params }: LoaderFunctionArgs) {
	const job = await prisma.job.findUnique({
		where: { id: params.jobId },
		select: {
			id: true,
			name: true,
			status: true,
			description: true,
			url: true,
			questions: true,
			source: true,
			createdat: true,
			companyid: true,
		},
	})

	invariantResponse(job, 'Not found', { status: 404 })

	const date = job && job.createdat ? new Date(job.createdat) : new Date();
	const timeAgo = formatDistanceToNow(date)

	return json({
		job,
		timeAgo,
	})
}

const DeleteFormSchema = z.object({
	intent: z.literal('delete-job'),
	noteId: z.string(),
})

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)
	const submission = parse(formData, {
		schema: DeleteFormSchema,
	})
	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}
	if (!submission.value) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}

	const { noteId } = submission.value

	const note = await prisma.note.findFirst({
		select: { id: true, ownerId: true, owner: { select: { username: true } } },
		where: { id: noteId },
	})
	invariantResponse(note, 'Not found', { status: 404 })

	const isOwner = note.ownerId === userId
	await requireUserWithPermission(
		request,
		isOwner ? `delete:job:own` : `delete:job:any`,
	)

	await prisma.job.delete({ where: { id: note.id } })

	return redirectWithToast(`/users/${note.owner.username}/jobs`, {
		type: 'success',
		title: 'Success',
		description: 'Your job has been deleted.',
	})
}

export default function JobRoute() {
	const data = useLoaderData<typeof loader>()
console.log('data', data)

	const user = useOptionalUser()
	//const isOwner = user?.id === data.job.ownerId
	//const canDelete = userHasPermission(
	//	user,
	//	isOwner ? `delete:job:own` : `delete:job:any`,
	//)
	//const displayBar = canDelete || isOwner

	return (
		<div className="absolute inset-0 flex flex-col px-10">
			<h2 className="mb-2 pt-12 text-h2 lg:mb-6">{data.job.name}</h2>
			<div className={`'pb-24' overflow-y-auto`}>
			{/* <div className={`${displayBar ? 'pb-24' : 'pb-12'} overflow-y-auto`}> */}
				{/* <ul className="flex flex-wrap gap-5 py-5">
					{data.note.images.map(image => (
						<li key={image.id}>
							<a href={getNoteImgSrc(image.id)}>
								<img
									src={getNoteImgSrc(image.id)}
									alt={image.altText ?? ''}
									className="h-32 w-32 rounded-lg object-cover"
								/>
							</a>
						</li>
					))}
				</ul> */}
				<p className="whitespace-break-spaces text-sm md:text-lg">
					<span className="font-semibold pr-3">Status</span>
					{data.job.status}
				</p>
				<p className="whitespace-break-spaces text-sm md:text-lg">
					<span className="font-semibold pr-3">Description</span>
					{data.job.description}
				</p>
				<p className="whitespace-break-spaces text-sm md:text-lg">
					<span className="font-semibold pr-3">Questions</span>
					{data.job.questions}
				</p>
				<p className="whitespace-break-spaces text-sm md:text-lg">
					<span className="font-semibold pr-3">URL</span>
					{data.job.url}
				</p>
				<p className="whitespace-break-spaces text-sm md:text-lg">
					<span className="font-semibold pr-3">Source</span>
					{data.job.source}
				</p>
				<p className="whitespace-break-spaces md:text-sm text-slate-500">
					<span className="font-light pr-3">Created at</span>
					{data.job.createdat}
				</p>

			</div>
			{/* {displayBar ? ( */}
				<div className={floatingToolbarClassName}>
					<span className="text-sm text-foreground/90 max-[524px]:hidden">
						<Icon name="clock" className="scale-125">
							{data.timeAgo} ago
						</Icon>
					</span>
					<div className="grid flex-1 grid-cols-2 justify-end gap-2 min-[525px]:flex md:gap-4">
						{/* {canDelete ? <DeleteNote id={data.note.id} /> : null} */}
						<Button
							asChild
							className="min-[525px]:max-md:aspect-square min-[525px]:max-md:px-0"
						>
							<Link to="edit">
								<Icon name="pencil-1" className="scale-125 max-md:scale-150">
									<span className="max-md:hidden">Edit</span>
								</Icon>
							</Link>
						</Button>
					</div>
				</div>
			{/* ) : null} */}
		</div>
	)
}

export function DeleteNote({ id }: { id: string }) {
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()
	const [form] = useForm({
		id: 'delete-note',
		lastSubmission: actionData?.submission,
	})

	return (
		<Form method="POST" {...form.props}>
			<AuthenticityTokenInput />
			<input type="hidden" name="noteId" value={id} />
			<StatusButton
				type="submit"
				name="intent"
				value="delete-note"
				variant="destructive"
				status={isPending ? 'pending' : actionData?.status ?? 'idle'}
				disabled={isPending}
				className="w-full max-md:aspect-square max-md:px-0"
			>
				<Icon name="trash" className="scale-125 max-md:scale-150">
					<span className="max-md:hidden">Delete</span>
				</Icon>
			</StatusButton>
			<ErrorList errors={form.errors} id={form.errorId} />
		</Form>
	)
}

export const meta: MetaFunction<
	typeof loader,
	{ 'routes/users+/$username_+/jobs': typeof notesLoader }
> = ({ data, params, matches }) => {
	const notesMatch = matches.find(
		m => m.id === 'routes/users+/$username_+/jobs',
	)
	const displayName = notesMatch?.data?.owner.name ?? params.username
	const noteTitle = data?.job.name ?? 'Job'
	const noteContentsSummary =
		data && data.job.description.length > 100
			? data?.job.description.slice(0, 97) + '...'
			: 'No content'
	return [
		{ title: `${noteTitle} | ${displayName}'s Notes | Epic Notes` },
		{
			name: 'description',
			content: noteContentsSummary,
		},
	]
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				403: () => <p>You are not allowed to do that</p>,
				404: ({ params }) => (
					<p>No job with the id "{params.noteId}" exists</p>
				),
			}}
		/>
	)
}
