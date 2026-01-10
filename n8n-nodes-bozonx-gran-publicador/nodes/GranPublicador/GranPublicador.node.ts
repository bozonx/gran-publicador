import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { PostType, PublicationStatus } from './types';

export class GranPublicador implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Gran Publicador',
		name: 'granPublicador',
		icon: 'file:gran-publicador.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with Gran Publicador API',
		defaults: {
			name: 'Gran Publicador',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'granPublicadorApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Publication',
						value: 'publication',
					},
				],
				default: 'publication',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['publication'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Create a new publication',
						action: 'Create a publication',
					},
					{
						name: 'Add Content',
						value: 'addContent',
						description: 'Add source texts and media to an existing publication',
						action: 'Add content to a publication',
					},
				],
				default: 'create',
			},
			// --- Creation Fields ---
			{
				displayName: 'Project ID',
				name: 'projectId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['publication'],
						operation: ['create'],
					},
				},
				description: 'The ID of the project where the publication will be created',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['publication'],
						operation: ['create'],
					},
				},
				description: 'The title of the publication',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: 'en-US',
				required: true,
				displayOptions: {
					show: {
						resource: ['publication'],
						operation: ['create'],
					},
				},
				description: 'The language code for the publication (e.g., en-US, ru-RU)',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Draft', value: PublicationStatus.DRAFT },
					{ name: 'Ready', value: PublicationStatus.READY },
				],
				default: PublicationStatus.DRAFT,
				displayOptions: {
					show: {
						resource: ['publication'],
						operation: ['create'],
					},
				},
				description: 'The initial status of the publication',
			},
			{
				displayName: 'Post Type',
				name: 'postType',
				type: 'options',
				description: 'The type of content being published (e.g., Post, Article, Video)',
				options: [
					{ name: 'Post', value: PostType.POST },
					{ name: 'Article', value: PostType.ARTICLE },
					{ name: 'News', value: PostType.NEWS },
					{ name: 'Video', value: PostType.VIDEO },
					{ name: 'Short', value: PostType.SHORT },
					{ name: 'Story', value: PostType.STORY },
				],
				default: PostType.POST,
				displayOptions: {
					show: {
						resource: ['publication'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				default: '',
				description: 'Comma-separated tags for the publication',
				displayOptions: {
					show: {
						resource: ['publication'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['publication'],
						operation: ['create'],
					},
				},
				options: [
					{
						displayName: 'Author Comment',
						name: 'authorComment',
						type: 'string',
						typeOptions: {
							rows: 2,
						},
						default: '',
						description: 'Commentary from the author to be published along with the content',
					},
					{
						displayName: 'Content',
						name: 'content',
						type: 'string',
						typeOptions: {
							rows: 4,
						},
						default: '',
						description: 'The main text content of the publication',
					},
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						typeOptions: {
							rows: 2,
						},
						default: '',
						description: 'Short description or SEO summary of the publication',
					},
					{
						displayName: 'Meta',
						name: 'meta',
						type: 'json',
						default: '{}',
						description: 'Additional metadata in JSON format',
					},
					{
						displayName: 'Post Date',
						name: 'postDate',
						type: 'dateTime',
						default: '',
						description: 'The date associated with the content (e.g., event date), not the publication date',
					},
					{
						displayName: 'Scheduled At',
						name: 'scheduledAt',
						type: 'dateTime',
						default: '',
						description: 'Date and time when the publication should be posted',
					},
					{
						displayName: 'Translate To All Languages',
						name: 'translateToAll',
						type: 'boolean',
						default: false,
						description: 'Whether to automatically create translations for other project languages',
					},
				],
			},
			// --- Add Content Fields ---
			{
				displayName: 'Publication ID',
				name: 'id',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['publication'],
						operation: ['addContent'],
					},
				},
				description: 'The ID of the publication to add content to',
			},
			{
				displayName: 'Source Texts',
				name: 'sourceTexts',
				type: 'json',
				default: '[]',
				description: 'Array of source text objects: [{"content": "...", "source": "..."}]',
				displayOptions: {
					show: {
						resource: ['publication'],
						operation: ['addContent', 'create'],
					},
				},
			},
			// --- Media Handle ---
			{
				displayName: 'Media URLs',
				name: 'mediaUrls',
				type: 'string',
				default: '',
				description: 'Comma-separated list of media URLs to upload',
				displayOptions: {
					show: {
						resource: ['publication'],
						operation: ['create', 'addContent'],
					},
				},
			},
			{
				displayName: 'Binary Media',
				name: 'binaryMedia',
				type: 'boolean',
				default: false,
				description: 'Whether to upload media from binary data',
				displayOptions: {
					show: {
						resource: ['publication'],
						operation: ['create', 'addContent'],
					},
				},
			},
			{
				displayName: 'Binary Property Names',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Comma-separated list of binary property names to upload',
				displayOptions: {
					show: {
						resource: ['publication'],
						operation: ['create', 'addContent'],
						binaryMedia: [true],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = await this.getCredentials('granPublicadorApi');
		const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '') + '/api/v1';

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'publication') {
					if (operation === 'create') {
						const projectId = this.getNodeParameter('projectId', i) as string;
						const title = this.getNodeParameter('title', i) as string;
						const language = this.getNodeParameter('language', i) as string;
						const status = this.getNodeParameter('status', i) as string;
						const postType = this.getNodeParameter('postType', i) as string;
						const tags = this.getNodeParameter('tags', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						const sourceTextsJson = this.getNodeParameter('sourceTexts', i, '[]') as string | any[];

						let sourceTexts = [];
						if (typeof sourceTextsJson === 'string') {
							try {
								sourceTexts = JSON.parse(sourceTextsJson);
							} catch (e) {
								throw new Error(`Invalid JSON in 'Source Texts' for item ${i}. Expected array of objects.`);
							}
						} else {
							sourceTexts = sourceTextsJson;
						}

						const body: IDataObject = {
							projectId,
							title,
							language,
							status,
							postType,
							tags,
							sourceTexts,
							...additionalFields,
						};

						// 1. Create Publication
						const response = await this.helpers.requestWithAuthentication.call(this, 'granPublicadorApi', {
							method: 'POST',
							uri: `${baseUrl}/publications`,
							body,
							json: true,
						});

						const publicationId = response.id;

						// 2. Handle Media if needed
						await handleMediaUpload.call(this, i, items[i], publicationId, baseUrl);

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					} else if (operation === 'addContent') {
						const publicationId = this.getNodeParameter('id', i) as string;
						const sourceTextsJson = this.getNodeParameter('sourceTexts', i, '[]') as string | any[];

						let sourceTexts = [];
						if (typeof sourceTextsJson === 'string') {
							try {
								sourceTexts = JSON.parse(sourceTextsJson);
							} catch (e) {
								throw new Error(`Invalid JSON in 'Source Texts' for item ${i}. Expected array of objects.`);
							}
						} else {
							sourceTexts = sourceTextsJson;
						}

						// 1. Update sourceTexts (PATCH)
						let response = await this.helpers.requestWithAuthentication.call(this, 'granPublicadorApi', {
							method: 'PATCH',
							uri: `${baseUrl}/publications/${publicationId}`,
							body: { sourceTexts },
							json: true,
						});

						// 2. Handle Media (POST /media)
						await handleMediaUpload.call(this, i, items[i], publicationId, baseUrl);

						// Fetch latest state
						response = await this.helpers.requestWithAuthentication.call(this, 'granPublicadorApi', {
							method: 'GET',
							uri: `${baseUrl}/publications/${publicationId}`,
							json: true,
						});

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

async function handleMediaUpload(
	this: IExecuteFunctions,
	itemIndex: number,
	item: INodeExecutionData,
	publicationId: string,
	baseUrl: string,
): Promise<void> {
	const mediaUrlsStr = this.getNodeParameter('mediaUrls', itemIndex, '') as string;
	const mediaUrls = mediaUrlsStr.split(',').map((u) => u.trim()).filter((u) => u);

	for (const url of mediaUrls) {
		const uploadResponse = await this.helpers.requestWithAuthentication.call(this, 'granPublicadorApi', {
			method: 'POST',
			uri: `${baseUrl}/media/upload-from-url`,
			body: { url },
			json: true,
		});

		const mediaId = uploadResponse.id;

		await this.helpers.requestWithAuthentication.call(this, 'granPublicadorApi', {
			method: 'POST',
			uri: `${baseUrl}/publications/${publicationId}/media`,
			body: {
				media: [{ id: mediaId }],
			},
			json: true,
		});
	}

	const binaryMedia = this.getNodeParameter('binaryMedia', itemIndex, false) as boolean;
	if (!binaryMedia) return;

	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
	const propertyNames = binaryPropertyName.split(',').map((p) => p.trim());

	for (const propertyName of propertyNames) {
		if (item.binary?.[propertyName]) {
			const binaryData = item.binary![propertyName];
			const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, propertyName);

			// Upload file
			const uploadResponse = await this.helpers.requestWithAuthentication.call(this, 'granPublicadorApi', {
				method: 'POST',
				uri: `${baseUrl}/media/upload`,
				formData: {
					file: {
						value: buffer,
						options: {
							filename: binaryData.fileName || 'upload',
							contentType: binaryData.mimeType,
						},
					},
				},
				json: true,
			});

			const mediaId = uploadResponse.id;

			// Attach to publication
			await this.helpers.requestWithAuthentication.call(this, 'granPublicadorApi', {
				method: 'POST',
				uri: `${baseUrl}/publications/${publicationId}/media`,
				body: {
					media: [{ id: mediaId }],
				},
				json: true,
			});
		}
	}
}
