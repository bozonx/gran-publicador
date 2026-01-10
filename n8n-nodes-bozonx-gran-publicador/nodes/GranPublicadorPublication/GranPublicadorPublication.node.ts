import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { load as yamlLoad } from 'js-yaml';
import { PostType, PublicationStatus } from './types';

export class GranPublicadorPublication implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Gran Publicador (Publications)',
		name: 'granPublicadorPublication',
		icon: 'file:gran-publicador.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Manage publications in Gran Publicador',
		defaults: {
			name: 'Gran Publicador (Publications)',
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
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
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
						operation: ['create'],
					},
				},
				description: 'The ID of the project where the publication will be created',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: 'en-US',
				required: true,
				displayOptions: {
					show: {
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
						operation: ['create'],
					},
				},
				description: 'The title of the publication',
			},
			{
				displayName: 'Content',
				name: 'content',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				displayOptions: {
					show: {
						operation: ['create'],
					},
				},
				description: 'The main text content of the publication',
			},
			{
				displayName: 'Source Texts (YAML/JSON)',
				name: 'sourceTexts',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description:
					'Initial source text objects in YAML or JSON format: [{"content": "...", "source": "..."}]',
				displayOptions: {
					show: {
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
						operation: ['create'],
					},
				},
				options: [
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
						displayName: 'Meta (YAML/JSON)',
						name: 'meta',
						type: 'string',
						typeOptions: {
							rows: 4,
						},
						default: '',
						description:
							'Additional metadata in YAML or JSON format. If a string is provided, it will first be parsed as YAML, then as JSON.',
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
						displayName: 'Channel IDs',
						name: 'channelIds',
						type: 'string',
						default: '',
						description: 'Comma-separated list of channel IDs to post to',
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
						operation: ['addContent'],
					},
				},
				description: 'The ID of the publication to add content to',
			},
			{
				displayName: 'Source Texts to Add (YAML/JSON)',
				name: 'sourceTexts',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description:
					'Source text objects to append in YAML or JSON format: [{"content": "...", "source": "..."}]',
				displayOptions: {
					show: {
						operation: ['addContent'],
					},
				},
			},
			// --- Media Handle ---
			{
				displayName: 'Media',
				name: 'media',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Media Item',
				default: {},
				displayOptions: {
					show: {
						operation: ['create', 'addContent'],
					},
				},
				options: [
					{
						name: 'mediaItem',
						displayName: 'Media Item',
						values: [
							{
								displayName: 'Mode',
								name: 'mode',
								type: 'options',
								options: [
									{ name: 'URL', value: 'url' },
									{ name: 'Telegram', value: 'telegram' },
								],
								default: 'url',
							},
							{
								displayName: 'URL',
								name: 'url',
								type: 'string',
								default: '',
								displayOptions: {
									show: {
										mode: ['url'],
									},
								},
							},
							{
								displayName: 'Telegram File ID',
								name: 'fileId',
								type: 'string',
								default: '',
								displayOptions: {
									show: {
										mode: ['telegram'],
									},
								},
							},
							{
								displayName: 'Type',
								name: 'type',
								type: 'options',
								options: [
									{ name: 'Image', value: 'IMAGE' },
									{ name: 'Video', value: 'VIDEO' },
									{ name: 'Audio', value: 'AUDIO' },
									{ name: 'Document', value: 'DOCUMENT' },
								],
								default: 'IMAGE',
								displayOptions: {
									show: {
										mode: ['telegram'],
									},
								},
							},
						],
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = await this.getCredentials('granPublicadorApi');
		const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '') + '/api/v1';

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'create') {
					const projectId = this.getNodeParameter('projectId', i) as string;
					const title = this.getNodeParameter('title', i) as string;
					const language = this.getNodeParameter('language', i) as string;
					const status = this.getNodeParameter('status', i) as string;
					const postType = this.getNodeParameter('postType', i) as string;
					const tags = this.getNodeParameter('tags', i) as string;
					const content = this.getNodeParameter('content', i, '') as string;
					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
					const sourceTextsRaw = this.getNodeParameter('sourceTexts', i, '') as string | any[];

					const sourceTexts = parseYamlOrJson.call(this, sourceTextsRaw, i, 'Source Texts');

					if (additionalFields.meta) {
						additionalFields.meta = parseYamlOrJson.call(this, additionalFields.meta, i, 'Meta');
					}

					if (additionalFields.channelIds) {
						if (typeof additionalFields.channelIds === 'string') {
							additionalFields.channelIds = (additionalFields.channelIds as string)
								.split(',')
								.map((id) => id.trim())
								.filter((id) => id);
						}
					}

					const body: IDataObject = {
						projectId,
						title,
						language,
						status,
						postType,
						tags,
						content,
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
					const sourceTextsRaw = this.getNodeParameter('sourceTexts', i, '') as string | any[];

					const sourceTexts = parseYamlOrJson.call(this, sourceTextsRaw, i, 'Source Texts');

					// 1. Update sourceTexts (PATCH)
					let response = await this.helpers.requestWithAuthentication.call(this, 'granPublicadorApi', {
						method: 'PATCH',
						uri: `${baseUrl}/publications/${publicationId}`,
						body: { sourceTexts, appendSourceTexts: true },
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
	const media = this.getNodeParameter('media', itemIndex, { mediaItem: [] }) as {
		mediaItem: Array<{
			mode: 'url' | 'telegram';
			url?: string;
			fileId?: string;
			type?: string;
		}>;
	};

	for (const mediaData of media.mediaItem) {
		let mediaId: string | undefined;

		if (mediaData.mode === 'url' && mediaData.url) {
			const uploadResponse = await this.helpers.requestWithAuthentication.call(this, 'granPublicadorApi', {
				method: 'POST',
				uri: `${baseUrl}/media/upload-from-url`,
				body: { url: mediaData.url },
				json: true,
			});
			mediaId = uploadResponse.id;
		} else if (mediaData.mode === 'telegram' && mediaData.fileId) {
			const uploadResponse = await this.helpers.requestWithAuthentication.call(this, 'granPublicadorApi', {
				method: 'POST',
				uri: `${baseUrl}/media`,
				body: {
					type: mediaData.type || 'IMAGE',
					storageType: 'TELEGRAM',
					storagePath: mediaData.fileId,
				},
				json: true,
			});
			mediaId = uploadResponse.id;
		}

		if (mediaId) {
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

/**
 * Parses YAML or JSON string into an object/array.
 * If data is not a string, returns it as is.
 */
function parseYamlOrJson(
	this: IExecuteFunctions,
	data: any,
	itemIndex: number,
	fieldName: string,
): any {
	if (typeof data !== 'string' || data.trim() === '') {
		return data || (fieldName === 'Source Texts' ? [] : {});
	}

	try {
		// Try YAML first (YAML is a superset of JSON)
		return yamlLoad(data);
	} catch (yamlError) {
		// If YAML parsing fails, try JSON
		try {
			return JSON.parse(data);
		} catch (jsonError) {
			throw new NodeOperationError(
				this.getNode(),
				`Invalid YAML or JSON provided in ${fieldName}: ${(jsonError as Error).message}`,
				{ itemIndex },
			);
		}
	}
}
