import { Test, type TestingModule } from '@nestjs/testing';
import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../../../../src/modules/llm/llm.service.js';
import type { GenerateContentDto } from '../../../../src/modules/llm/dto/generate-content.dto.js';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

describe('LlmService', () => {
  let service: LlmService;
  let mockAgent: MockAgent;
  let originalDispatcher: any;

  const mockConfig = {
    serviceUrl: 'http://localhost:8080/api/v1',
    defaultTags: ['test'],
    defaultType: 'fast',
    maxModelSwitches: 3,
    timeoutSecs: 60,
  };

  const mockAppConfig = {
    microserviceRequestTimeoutSeconds: 30,
  };

  beforeAll(() => {
    originalDispatcher = getGlobalDispatcher();
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  afterAll(() => {
    setGlobalDispatcher(originalDispatcher);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'llm') return mockConfig;
              if (key === 'app.microserviceRequestTimeoutSeconds') {
                return mockAppConfig.microserviceRequestTimeoutSeconds;
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
  });

  describe('generateContent', () => {
    it('should successfully generate content with simple prompt', async () => {
      const dto: GenerateContentDto = {
        prompt: 'Test prompt',
        temperature: 0.7,
        max_tokens: 2000,
      };

      const mockResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-3.5-turbo',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Generated content',
            },
            finish_reason: 'stop',
          },
        ],
      };

      const client = mockAgent.get('http://localhost:8080');
      client
        .intercept({
          path: '/api/v1/chat/completions',
          method: 'POST',
        })
        .reply(200, mockResponse);

      const result = await service.generateContent(dto);

      expect(result).toEqual(mockResponse);
    });

    it('should build prompt with selection and media descriptions on server', async () => {
      const dto: GenerateContentDto = {
        prompt: 'Rewrite it',
        onlyRawResult: true,
        selectionText: 'Selected text',
        content: 'Full content',
        useContent: true,
        mediaDescriptions: ['Image one', ''],
        contextLimitChars: 10000,
      };

      const mockResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Generated content',
            },
            finish_reason: 'stop',
          },
        ],
      };

      let capturedBody: any;
      const client = mockAgent.get('http://localhost:8080');
      client
        .intercept({
          path: '/api/v1/chat/completions',
          method: 'POST',
        })
        .reply(200, opts => {
          capturedBody = JSON.parse(opts.body as string);
          return mockResponse;
        });

      await service.generateContent(dto);

      const userMsg = capturedBody.messages.find((m: any) => m.role === 'user');
      expect(userMsg).toBeTruthy();
      expect(userMsg.content).toContain('<selection>');
      expect(userMsg.content).toContain('Selected text');
      expect(userMsg.content).toContain('<image_description>Image one</image_description>');
      expect(userMsg.content).not.toContain('<source_content>');
    });

    it('should handle 4xx client errors', async () => {
      const dto: GenerateContentDto = {
        prompt: 'Test',
        temperature: 0.7,
        max_tokens: 2000,
      };

      const client = mockAgent.get('http://localhost:8080');
      client
        .intercept({
          path: '/api/v1/chat/completions',
          method: 'POST',
        })
        .reply(400, 'Bad request');

      await expect(service.generateContent(dto)).rejects.toThrow('LLM provider request failed');
    });
  });

  describe('extractContent', () => {
    it('should extract content from response', () => {
      const response: any = {
        choices: [{ message: { content: 'Test content' } }],
      };
      expect(service.extractContent(response)).toBe('Test content');
    });
  });

  describe('parsePublicationFieldsResponse', () => {
    it('should parse valid publication fields JSON', () => {
      const response: any = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                publication: {
                  title: 'Test Title',
                  description: 'Test Description',
                  content: 'Test Content',
                  tags: ['tag1', 'tag2', 'tag3'],
                },
                posts: [
                  {
                    channelId: 'ch-1',
                    content: 'Translated content',
                    tags: ['тег1', 'тег2'],
                  },
                ],
              }),
            },
          },
        ],
      };

      const result = service.parsePublicationFieldsResponse(response);

      expect(result.publication.title).toBe('Test Title');
      expect(result.publication.description).toBe('Test Description');
      expect(result.publication.content).toBe('Test Content');
      expect(result.publication.tags).toEqual(['tag1', 'tag2', 'tag3']);
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].channelId).toBe('ch-1');
      expect(result.posts[0].content).toBe('Translated content');
      expect(result.posts[0].tags).toEqual(['тег1', 'тег2']);
    });

    it('should handle empty posts array', () => {
      const response: any = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                publication: {
                  title: 'Title',
                  description: '',
                  content: 'Content',
                  tags: [],
                },
                posts: [],
              }),
            },
          },
        ],
      };

      const result = service.parsePublicationFieldsResponse(response);

      expect(result.publication.title).toBe('Title');
      expect(result.publication.tags).toEqual([]);
      expect(result.posts).toEqual([]);
    });

    it('should handle missing publication fields gracefully', () => {
      const response: any = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                publication: {},
                posts: [],
              }),
            },
          },
        ],
      };

      const result = service.parsePublicationFieldsResponse(response);

      expect(result.publication.title).toBe('');
      expect(result.publication.description).toBe('');
      expect(result.publication.content).toBe('');
      expect(result.publication.tags).toEqual([]);
    });

    it('should throw on invalid JSON', () => {
      const response: any = {
        choices: [{ message: { content: 'not valid json' } }],
      };

      expect(() => service.parsePublicationFieldsResponse(response)).toThrow(
        'LLM returned invalid JSON',
      );
    });

    it('should prefer _router.data when present', () => {
      const response: any = {
        choices: [
          {
            message: {
              content: 'not valid json',
            },
          },
        ],
        _router: {
          data: {
            publication: {
              title: 'From router',
              description: 'D',
              content: 'C',
              tags: ['t'],
            },
            posts: [],
          },
        },
      };

      const result = service.parsePublicationFieldsResponse(response);
      expect(result.publication.title).toBe('From router');
    });

    it('should handle JSON wrapped in markdown code blocks', () => {
      const json = JSON.stringify({
        publication: { title: 'T', description: 'D', content: 'C', tags: ['a'] },
        posts: [],
      });
      const response: any = {
        choices: [{ message: { content: '```json\n' + json + '\n```' } }],
      };

      const result = service.parsePublicationFieldsResponse(response);

      expect(result.publication.title).toBe('T');
      expect(result.publication.tags).toEqual(['a']);
    });

    it('should convert non-string tags to strings', () => {
      const response: any = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                publication: { title: '', description: '', content: '', tags: [1, 2, 'three'] },
                posts: [{ channelId: 'ch-1', content: '', tags: [true, 'tag'] }],
              }),
            },
          },
        ],
      };

      const result = service.parsePublicationFieldsResponse(response);

      expect(result.publication.tags).toEqual(['1', '2', 'three']);
      expect(result.posts[0].tags).toEqual(['true', 'tag']);
    });

    it('should handle multiple post blocks', () => {
      const response: any = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                publication: { title: 'T', description: 'D', content: 'C', tags: ['pub-tag'] },
                posts: [
                  { channelId: 'ch-1', content: '', tags: ['ch1-tag'] },
                  { channelId: 'ch-2', content: 'Translated', tags: ['ch2-tag1', 'ch2-tag2'] },
                  { channelId: 'ch-3', content: '', tags: [] },
                ],
              }),
            },
          },
        ],
      };

      const result = service.parsePublicationFieldsResponse(response);

      expect(result.posts).toHaveLength(3);
      expect(result.posts[0].channelId).toBe('ch-1');
      expect(result.posts[1].content).toBe('Translated');
      expect(result.posts[2].tags).toEqual([]);
    });
  });

  describe('generatePublicationFields', () => {
    it('should send correct request structure to LLM Router', async () => {
      const dto = {
        prompt: 'Source text for generation',
        publicationLanguage: 'ru-RU',
        channels: [
          {
            channelId: 'ch-1',
            channelName: 'Channel EN',
            tags: ['tech', 'news'],
          },
          { channelId: 'ch-2', channelName: 'Channel RU', tags: [] },
        ],
      };

      const mockResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                publication: { title: 'T', description: 'D', content: 'C', tags: ['t1'] },
                posts: [{ channelId: 'ch-1', content: 'EN content', tags: ['tech'] }],
              }),
            },
            finish_reason: 'stop',
          },
        ],
      };

      const client = mockAgent.get('http://localhost:8080');
      client
        .intercept({
          path: '/api/v1/chat/completions',
          method: 'POST',
        })
        .reply(200, mockResponse);

      const result = await service.generatePublicationFields(dto);

      expect(result.choices[0].message.content).toBeTruthy();
    });
  });
});
