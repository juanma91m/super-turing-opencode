export function dormantFixture(baseURL = 'http://127.0.0.1:11434/v1') {
  return { disabled_providers: ['ollama'], provider: { ollama: { npm: '@ai-sdk/openai-compatible', name: 'Local fixture', options: { baseURL },
    models: Object.fromEntries(Array.from({ length: 7 }, (_, index) => ['synthetic-model-' + index + ':test', { name: 'Synthetic display ' + index }])) } } };
}
