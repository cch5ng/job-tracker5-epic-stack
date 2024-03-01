import {
	conform,
	list,
	useFieldList,
	useFieldset,
	useForm,
	type FieldConfig,
} from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { createId as cuid } from '@paralleldrive/cuid2'
import { type Note, type NoteImage, type job } from '@prisma/client'
import {
	unstable_createMemoryUploadHandler as createMemoryUploadHandler,
	json,
	unstable_parseMultipartFormData as parseMultipartFormData,
	redirect,
	type ActionFunctionArgs,
	type SerializeFrom,
} from '@remix-run/node'
import { Form, useActionData } from '@remix-run/react'
import { useRef, useState } from 'react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.tsx'
import { ErrorList, Field, TextareaField } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { Textarea } from '#app/components/ui/textarea.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { cn, getNoteImgSrc, useIsPending } from '#app/utils/misc.tsx'

const nameMinLength = 1
const nameMaxLength = 100
const descriptionMinLength = 1
const descriptionMaxLength = 10000
const sourceMinLength = 1
const sourceMaxLength = 100
const statusMinLength = 1
const statusMaxLength = 10000

const MAX_UPLOAD_SIZE = 1024 * 1024 * 3 // 3MB

// const ImageFieldsetSchema = z.object({
// 	id: z.string().optional(),
// 	file: z
// 		.instanceof(File)
// 		.optional()
// 		.refine(file => {
// 			return !file || file.size <= MAX_UPLOAD_SIZE
// 		}, 'File size must be less than 3MB'),
// 	altText: z.string().optional(),
// })

//type ImageFieldset = z.infer<typeof ImageFieldsetSchema>

// function imageHasFile(
// 	image: ImageFieldset,
// ): image is ImageFieldset & { file: NonNullable<ImageFieldset['file']> } {
// 	return Boolean(image.file?.size && image.file?.size > 0)
// }

// function imageHasId(
// 	image: ImageFieldset,
// ): image is ImageFieldset & { id: NonNullable<ImageFieldset['id']> } {
// 	return image.id != null
// }

const JobEditorSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(nameMinLength).max(nameMaxLength),
	description: z.string().min(descriptionMinLength).max(descriptionMaxLength),
	questions: z.string().optional(),
	source: z.string().min(sourceMinLength).max(sourceMaxLength),
	status: z.string().min(statusMinLength).max(statusMaxLength),
	updatedAt: z.string(),
	url: z.string().optional(),
})


//TODO UPDATE
// const NoteEditorSchema = z.object({
// 	id: z.string().optional(),
// 	title: z.string(),
// 	content: z.string(),
// 	images: z.array(ImageFieldsetSchema).max(5).optional(),
// })

export async function action({ request }: ActionFunctionArgs) {
	console.log('gets here job action')
	const userId = await requireUserId(request)
	console.log('userId', userId)

	const formData = await parseMultipartFormData(
		request,
		createMemoryUploadHandler({ maxPartSize: MAX_UPLOAD_SIZE }),
	)
	console.log('formData', formData)

	await validateCSRF(formData, request.headers)


	//TODO UPDATE
	const submission = await parse(formData, {
		schema: JobEditorSchema.superRefine(async (data, ctx) => {
			console.log('id', data.id)

			if (!data.id) return

			const job = await prisma.job.findUnique({
				select: { id: true },
				where: { id: data.id, ownerId: userId },
			})

			console.log('job from job editor submission', job)
			if (!job) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Job not found',
				})
			}
		}).transform(async ({ images = [], ...data }) => {
			return {
				...data,
				// imageUpdates: await Promise.all(
				// 	images.filter(imageHasId).map(async i => {
				// 		if (imageHasFile(i)) {
				// 			return {
				// 				id: i.id,
				// 				altText: i.altText,
				// 				contentType: i.file.type,
				// 				blob: Buffer.from(await i.file.arrayBuffer()),
				// 			}
				// 		} else {
				// 			return {
				// 				id: i.id,
				// 				altText: i.altText,
				// 			}
				// 		}
				// 	}),
				// ),
				// newImages: await Promise.all(
				// 	images
				// 		.filter(imageHasFile)
				// 		.filter(i => !i.id)
				// 		.map(async image => {
				// 			return {
				// 				altText: image.altText,
				// 				contentType: image.file.type,
				// 				blob: Buffer.from(await image.file.arrayBuffer()),
				// 			}
				// 		}),
				// ),
			}
		}),
		async: true,
	})

	console.log('job submission', submission)

	if (submission.intent !== 'submit') {
		return json({ submission } as const)
	}

	if (!submission.value) {
		return json({ submission } as const, { status: 400 })
	}

	//TODO UPDATE
	console.log('submission.value', submission.value)

	const {
		id: jobId, //noteId,
		name,
		questions,
		source,
		url,
		updatedAt,
	} = submission.value

	//TODO UPDATE fix
	const updatedJob = await prisma.job.upsert({
		select: { id: true, owner: { select: { username: true } } },
		where: { id: jobId ?? '__new_job__' },
		create: {
			ownerId: userId,
			name,
			questions,
			source,
			url,
			updatedAt,
		},
		update: {
			name,
			questions,
			source,
			url,
			updatedAt,
		},
	})

	return redirect(
		`/users/${updatedJob.ownerId}/jobs/${updatedJob.id}`,
	)
}

//TODO UPDATE
export function JobEditor({
	note, job,
}: {
	note?: SerializeFrom<
		Pick<Note, 'id' | 'title' | 'content'> & {
			images: Array<Pick<NoteImage, 'id' | 'altText'>>
		}
	>,
	job?: SerializeFrom<
		Pick<job, 'id' | 'status' | 'name' | 'description' | 'url' | 'questions' | 'createdat' | 'companyid' | 'ownerId' | 'updatedAt' | 'source'>
	>
}) {

	console.log('job from job editor', job)
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()

	console.log('actionData', actionData)

	const [form, fields] = useForm({
		id: 'job-editor',
		constraint: getFieldsetConstraint(JobEditorSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: JobEditorSchema })
		},
		defaultValue: {
			description: job?.description ?? '',
			name: job?.name ?? '',
			questions: job?.questions ?? '',
			source: job?.source ?? '',
			status: job?.status ?? '',
			updatedAt: job?.updatedAt ?? '',
			url: job?.url ?? '',

			//title: note?.title ?? '',
			//content: note?.content ?? '',
			//images: note?.images ?? [{}],
		},
	})

	console.log('form', form)
	console.log('form onSubmit', form.props.onSubmit)
	console.log('fields', fields)

	//const imageList = useFieldList(form.ref, fields.images)

	return (
		<div className="absolute inset-0">
			<Form
				method="POST"
				className="flex h-full flex-col gap-y-4 overflow-y-auto overflow-x-hidden px-10 pb-28 pt-12"
				{...form.props}
				encType="multipart/form-data"
			>
				<AuthenticityTokenInput />
				{/*
					This hidden submit button is here to ensure that when the user hits
					"enter" on an input field, the primary form function is submitted
					rather than the first button in the form (which is delete/add image).
				*/}
				<button type="submit" className="hidden" />
				{job ? <input type="hidden" name="id" value={job.id} /> : null}
				<div className="flex flex-col gap-1">
					<Field
						labelProps={{ children: 'Name' }}
						inputProps={{
							autoFocus: true,
							...conform.input(fields.name, { ariaAttributes: true }),
						}}
						errors={fields.name.errors}
					/>
					<Field
						labelProps={{ children: 'Status' }}
						inputProps={{
							autoFocus: true,
							...conform.input(fields.status, { ariaAttributes: true }),
						}}
						errors={fields.status.errors}
					/>
					<Field
						labelProps={{ children: 'Description' }}
						inputProps={{
							autoFocus: true,
							...conform.input(fields.description, { ariaAttributes: true }),
						}}
						errors={fields.description.errors}
					/>
					<Field
						labelProps={{ children: 'URL' }}
						inputProps={{
							autoFocus: true,
							...conform.input(fields.url, { ariaAttributes: true }),
						}}
						errors={fields.url.errors}
					/>

					<TextareaField
						labelProps={{ children: 'Questions' }}
						textareaProps={{
							...conform.textarea(fields.questions, { ariaAttributes: true }),
						}}
						errors={fields.questions.errors}
					/>

					{/* <Field
						labelProps={{ children: 'Questions' }}
						inputProps={{
							autoFocus: true,
							...conform.input(fields.questions, { ariaAttributes: true }),
						}}
						errors={fields.questions.errors}
					/> */}
					<Field
						labelProps={{ children: 'Source' }}
						inputProps={{
							autoFocus: true,
							...conform.input(fields.source, { ariaAttributes: true }),
						}}
						errors={fields.source.errors}
					/>

				</div>
				<ErrorList id={form.errorId} errors={form.errors} />
			</Form>
			<div className={floatingToolbarClassName}>
				<Button form={form.id} variant="destructive" type="reset">
					Reset
				</Button>
				<StatusButton
					form={form.id}
					type="submit"
					disabled={isPending}
					status={isPending ? 'pending' : 'idle'}
				>
					Submit
				</StatusButton>
			</div>
		</div>
	)
}

// function ImageChooser({
// 	config,
// }: {
// 	config: FieldConfig<z.infer<typeof ImageFieldsetSchema>>
// }) {
// 	const ref = useRef<HTMLFieldSetElement>(null)
// 	const fields = useFieldset(ref, config)
// 	const existingImage = Boolean(fields.id.defaultValue)
// 	const [previewImage, setPreviewImage] = useState<string | null>(
// 		fields.id.defaultValue ? getNoteImgSrc(fields.id.defaultValue) : null,
// 	)
// 	const [altText, setAltText] = useState(fields.altText.defaultValue ?? '')

// 	return (
// 		<fieldset
// 			ref={ref}
// 			aria-invalid={Boolean(config.errors?.length) || undefined}
// 			aria-describedby={config.errors?.length ? config.errorId : undefined}
// 		>
// 			<div className="flex gap-3">
// 				<div className="w-32">
// 					<div className="relative h-32 w-32">
// 						<label
// 							htmlFor={fields.file.id}
// 							className={cn('group absolute h-32 w-32 rounded-lg', {
// 								'bg-accent opacity-40 focus-within:opacity-100 hover:opacity-100':
// 									!previewImage,
// 								'cursor-pointer focus-within:ring-2': !existingImage,
// 							})}
// 						>
// 							{previewImage ? (
// 								<div className="relative">
// 									<img
// 										src={previewImage}
// 										alt={altText ?? ''}
// 										className="h-32 w-32 rounded-lg object-cover"
// 									/>
// 									{existingImage ? null : (
// 										<div className="pointer-events-none absolute -right-0.5 -top-0.5 rotate-12 rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground shadow-md">
// 											new
// 										</div>
// 									)}
// 								</div>
// 							) : (
// 								<div className="flex h-32 w-32 items-center justify-center rounded-lg border border-muted-foreground text-4xl text-muted-foreground">
// 									<Icon name="plus" />
// 								</div>
// 							)}
// 							{existingImage ? (
// 								<input
// 									{...conform.input(fields.id, {
// 										type: 'hidden',
// 										ariaAttributes: true,
// 									})}
// 								/>
// 							) : null}
// 							<input
// 								aria-label="Image"
// 								className="absolute left-0 top-0 z-0 h-32 w-32 cursor-pointer opacity-0"
// 								onChange={event => {
// 									const file = event.target.files?.[0]

// 									if (file) {
// 										const reader = new FileReader()
// 										reader.onloadend = () => {
// 											setPreviewImage(reader.result as string)
// 										}
// 										reader.readAsDataURL(file)
// 									} else {
// 										setPreviewImage(null)
// 									}
// 								}}
// 								accept="image/*"
// 								{...conform.input(fields.file, {
// 									type: 'file',
// 									ariaAttributes: true,
// 								})}
// 							/>
// 						</label>
// 					</div>
// 					<div className="min-h-[32px] px-4 pb-3 pt-1">
// 						<ErrorList id={fields.file.errorId} errors={fields.file.errors} />
// 					</div>
// 				</div>
// 				<div className="flex-1">
// 					<Label htmlFor={fields.altText.id}>Alt Text</Label>
// 					<Textarea
// 						onChange={e => setAltText(e.currentTarget.value)}
// 						{...conform.textarea(fields.altText, { ariaAttributes: true })}
// 					/>
// 					<div className="min-h-[32px] px-4 pb-3 pt-1">
// 						<ErrorList
// 							id={fields.altText.errorId}
// 							errors={fields.altText.errors}
// 						/>
// 					</div>
// 				</div>
// 			</div>
// 			<div className="min-h-[32px] px-4 pb-3 pt-1">
// 				<ErrorList id={config.errorId} errors={config.errors} />
// 			</div>
// 		</fieldset>
// 	)
// }

//TODO fix
export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No job with the id "{params.jobId}" exists</p>
				),
			}}
		/>
	)
}
