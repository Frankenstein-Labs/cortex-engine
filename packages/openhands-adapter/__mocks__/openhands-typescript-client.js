class MockRemoteConversation {
  id = 'mock-conversation-id';
  state = { status: 'idle' };
  async start() {}
  async sendMessage() {}
  async run() {}
  async close() {}
}

class MockConversationManager {
  async createConversation() {
    return new MockRemoteConversation();
  }
  async loadConversation() {
    return new MockRemoteConversation();
  }
  async getConversation() {
    return new MockRemoteConversation();
  }
  async deleteConversation() {}
  async getConversations() {
    return [];
  }
  close() {}
}

class MockWebSocketCallbackClient {
  constructor() {}
  start() {}
  stop() {}
}

module.exports = {
  ConversationManager: MockConversationManager,
  RemoteConversation: MockRemoteConversation,
  Agent: class MockAgent {},
  RemoteWorkspace: class MockRemoteWorkspace {},
  WebSocketCallbackClient: MockWebSocketCallbackClient,
};
