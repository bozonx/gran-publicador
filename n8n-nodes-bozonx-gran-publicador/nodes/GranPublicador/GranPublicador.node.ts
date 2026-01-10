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
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: 'en',
				required: true,
				displayOptions: {
					show: {
						resource: ['publication'],
						operation: ['create'],
					},
				},
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
			},
			{
				displayName: 'Post Type',
				name: 'postType',
				type: 'options',
				options: [
					{ name: 'Post', value: PostType.POST },
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
						displayName: 'Content',
						name: 'content',
						type: 'string',
						typeOptions: {
							rows: 4,
						},
						default: '',
					},
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						typeOptions: {
							rows: 2,
						},
						default: '',
					},
					{
						displayName: 'Scheduled At',
						name: 'scheduledAt',
						type: 'dateTime',
						default: '',
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
		const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'publication') {
					if (operation === 'create') {
						const projectId = this.getNodeParameter('projectId', i) as string;
						const title = this.getNodeParameter('title', i) as string;
						const language = this.getNodeParameter('language', i) as string;
						const status = this.getNodeParameter('status', i) as string;
						const postType = this.getNodeParameter('postType', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						const sourceTextsJson = this.getNodeParameter('sourceTexts', i, '[]') as string | any[];

						let sourceTexts = [];
						if (typeof sourceTextsJson === 'string') {
							sourceTexts = JSON.parse(sourceTextsJson);
						} else {
							sourceTexts = sourceTextsJson;
						}

						const body: IDataObject = {
							projectId,
							title,
							language,
							status,
							postType,
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
						await handleMediaUpload.call(this, i, publicationId, baseUrl);

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					} else if (operation === 'addContent') {
						const publicationId = this.getNodeParameter('id', i) as string;
						const sourceTextsJson = this.getNodeParameter('sourceTexts', i, '[]') as string | any[];

						let sourceTexts = [];
						if (typeof sourceTextsJson === 'string') {
							sourceTexts = JSON.parse(sourceTextsJson);
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
						await handleMediaUpload.call(this, i, publicationId, baseUrl);

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

	const items = this.getInputData();
	for (const propertyName of propertyNames) {
		if (items[itemIndex].binary?.[propertyName]) {
			const binaryData = items[itemIndex].binary![propertyName];
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
