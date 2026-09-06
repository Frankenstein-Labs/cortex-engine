const mockClient = {
  session: {
    create: async () => ({ data: { id: 'mock-session-id' } }),
    get: async () => ({ data: { id: 'mock-session-id', title: 'test' } }),
    prompt: async () => ({ data: { message: 'mock response' } }),
    delete: async () => ({ data: null }),
    status: async () => ({}),
  },
  event: {
    subscribe: async () => ({
      stream: (async function* () {
        yield { type: 'SessionEvent.Step.Ended', data: {} };
      })(),
    }),
  },
};

const mockCreateKiloClient = (config) => mockClient;

const mockCreateKiloServer = async (options) => ({
  url: 'http://127.0.0.1:4096',
  close: async () => {},
});

module.exports = {
  createKiloClient: mockCreateKiloClient,
  createKiloServer: mockCreateKiloServer,
  KiloClient: mockClient,
};
