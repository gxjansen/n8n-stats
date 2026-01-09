/**
 * Fetch All Nodes Script
 *
 * This script fetches usage counts for ALL n8n nodes by querying the API
 * for each node type individually. This bypasses the API's limit of only
 * returning top 10 nodes in filters.
 *
 * Run weekly: npx tsx scripts/fetch-all-nodes.ts
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const API_BASE = 'https://api.n8n.io/api/templates/search';
const RATE_LIMIT_DELAY = 200; // ms between requests
const DATA_DIR = join(process.cwd(), 'public', 'data');
const OUTPUT_PATH = join(DATA_DIR, 'all-nodes-data.json');

// Comprehensive list of n8n node types
// Format: { type: 'api-node-type', displayName: 'Human Name', category: 'Category' }
const KNOWN_NODES = [
  // === CORE UTILITY NODES ===
  // Flow Control
  { type: 'n8n-nodes-base.if', displayName: 'If', category: 'Flow Control' },
  { type: 'n8n-nodes-base.switch', displayName: 'Switch', category: 'Flow Control' },
  { type: 'n8n-nodes-base.merge', displayName: 'Merge', category: 'Flow Control' },
  { type: 'n8n-nodes-base.splitInBatches', displayName: 'Split In Batches', category: 'Flow Control' },
  { type: 'n8n-nodes-base.wait', displayName: 'Wait', category: 'Flow Control' },
  { type: 'n8n-nodes-base.noOp', displayName: 'No Operation', category: 'Flow Control' },
  { type: 'n8n-nodes-base.executeWorkflow', displayName: 'Execute Workflow', category: 'Flow Control' },
  { type: 'n8n-nodes-base.respondToWebhook', displayName: 'Respond to Webhook', category: 'Flow Control' },

  // Triggers
  { type: 'n8n-nodes-base.scheduleTrigger', displayName: 'Schedule Trigger', category: 'Triggers' },
  { type: 'n8n-nodes-base.manualTrigger', displayName: 'Manual Trigger', category: 'Triggers' },
  { type: 'n8n-nodes-base.webhook', displayName: 'Webhook', category: 'Triggers' },
  { type: 'n8n-nodes-base.cron', displayName: 'Cron', category: 'Triggers' },
  { type: 'n8n-nodes-base.errorTrigger', displayName: 'Error Trigger', category: 'Triggers' },
  { type: 'n8n-nodes-base.workflowTrigger', displayName: 'Workflow Trigger', category: 'Triggers' },
  { type: 'n8n-nodes-base.start', displayName: 'Start', category: 'Triggers' },

  // Data Transform
  { type: 'n8n-nodes-base.set', displayName: 'Edit Fields (Set)', category: 'Data Transform' },
  { type: 'n8n-nodes-base.code', displayName: 'Code', category: 'Data Transform' },
  { type: 'n8n-nodes-base.function', displayName: 'Function', category: 'Data Transform' },
  { type: 'n8n-nodes-base.functionItem', displayName: 'Function Item', category: 'Data Transform' },
  { type: 'n8n-nodes-base.filter', displayName: 'Filter', category: 'Data Transform' },
  { type: 'n8n-nodes-base.sort', displayName: 'Sort', category: 'Data Transform' },
  { type: 'n8n-nodes-base.limit', displayName: 'Limit', category: 'Data Transform' },
  { type: 'n8n-nodes-base.aggregate', displayName: 'Aggregate', category: 'Data Transform' },
  { type: 'n8n-nodes-base.removeDuplicates', displayName: 'Remove Duplicates', category: 'Data Transform' },
  { type: 'n8n-nodes-base.splitOut', displayName: 'Split Out', category: 'Data Transform' },
  { type: 'n8n-nodes-base.itemLists', displayName: 'Item Lists', category: 'Data Transform' },
  { type: 'n8n-nodes-base.renameKeys', displayName: 'Rename Keys', category: 'Data Transform' },
  { type: 'n8n-nodes-base.spreadsheetFile', displayName: 'Spreadsheet File', category: 'Data Transform' },
  { type: 'n8n-nodes-base.xml', displayName: 'XML', category: 'Data Transform' },
  { type: 'n8n-nodes-base.html', displayName: 'HTML', category: 'Data Transform' },
  { type: 'n8n-nodes-base.markdown', displayName: 'Markdown', category: 'Data Transform' },
  { type: 'n8n-nodes-base.crypto', displayName: 'Crypto', category: 'Data Transform' },
  { type: 'n8n-nodes-base.dateTime', displayName: 'Date & Time', category: 'Data Transform' },
  { type: 'n8n-nodes-base.compression', displayName: 'Compression', category: 'Data Transform' },
  { type: 'n8n-nodes-base.compareDatasets', displayName: 'Compare Datasets', category: 'Data Transform' },

  // Utility
  { type: 'n8n-nodes-base.stickyNote', displayName: 'Sticky Note', category: 'Utility' },
  { type: 'n8n-nodes-base.debug', displayName: 'Debug', category: 'Utility' },
  { type: 'n8n-nodes-base.n8n', displayName: 'n8n', category: 'Utility' },
  { type: 'n8n-nodes-base.executeCommand', displayName: 'Execute Command', category: 'Utility' },

  // HTTP & APIs
  { type: 'n8n-nodes-base.httpRequest', displayName: 'HTTP Request', category: 'HTTP & APIs' },
  { type: 'n8n-nodes-base.graphql', displayName: 'GraphQL', category: 'HTTP & APIs' },
  { type: 'n8n-nodes-base.ssh', displayName: 'SSH', category: 'HTTP & APIs' },
  { type: 'n8n-nodes-base.ftp', displayName: 'FTP', category: 'HTTP & APIs' },
  { type: 'n8n-nodes-base.rssFeedRead', displayName: 'RSS Feed Read', category: 'HTTP & APIs' },

  // Files
  { type: 'n8n-nodes-base.readBinaryFiles', displayName: 'Read Binary Files', category: 'Files' },
  { type: 'n8n-nodes-base.writeBinaryFile', displayName: 'Write Binary File', category: 'Files' },
  { type: 'n8n-nodes-base.readPdf', displayName: 'Read PDF', category: 'Files' },
  { type: 'n8n-nodes-base.extractFromFile', displayName: 'Extract From File', category: 'Files' },
  { type: 'n8n-nodes-base.convertToFile', displayName: 'Convert to File', category: 'Files' },

  // === COMMUNICATION ===
  { type: 'n8n-nodes-base.emailSend', displayName: 'Send Email', category: 'Communication' },
  { type: 'n8n-nodes-base.emailReadImap', displayName: 'Email (IMAP)', category: 'Communication' },
  { type: 'n8n-nodes-base.gmail', displayName: 'Gmail', category: 'Communication' },
  { type: 'n8n-nodes-base.gmailTrigger', displayName: 'Gmail Trigger', category: 'Communication' },
  { type: 'n8n-nodes-base.slack', displayName: 'Slack', category: 'Communication' },
  { type: 'n8n-nodes-base.slackTrigger', displayName: 'Slack Trigger', category: 'Communication' },
  { type: 'n8n-nodes-base.telegram', displayName: 'Telegram', category: 'Communication' },
  { type: 'n8n-nodes-base.telegramTrigger', displayName: 'Telegram Trigger', category: 'Communication' },
  { type: 'n8n-nodes-base.discord', displayName: 'Discord', category: 'Communication' },
  { type: 'n8n-nodes-base.discordTrigger', displayName: 'Discord Trigger', category: 'Communication' },
  { type: 'n8n-nodes-base.microsoftTeams', displayName: 'Microsoft Teams', category: 'Communication' },
  { type: 'n8n-nodes-base.whatsApp', displayName: 'WhatsApp Business Cloud', category: 'Communication' },
  { type: 'n8n-nodes-base.twilio', displayName: 'Twilio', category: 'Communication' },
  { type: 'n8n-nodes-base.sendGrid', displayName: 'SendGrid', category: 'Communication' },
  { type: 'n8n-nodes-base.mailchimp', displayName: 'Mailchimp', category: 'Communication' },
  { type: 'n8n-nodes-base.mailgun', displayName: 'Mailgun', category: 'Communication' },

  // === SOCIAL MEDIA ===
  { type: 'n8n-nodes-base.twitter', displayName: 'X (Twitter)', category: 'Social Media' },
  { type: 'n8n-nodes-base.linkedin', displayName: 'LinkedIn', category: 'Social Media' },
  { type: 'n8n-nodes-base.facebookGraphApi', displayName: 'Facebook Graph API', category: 'Social Media' },
  { type: 'n8n-nodes-base.reddit', displayName: 'Reddit', category: 'Social Media' },

  // === GOOGLE SERVICES ===
  { type: 'n8n-nodes-base.googleSheets', displayName: 'Google Sheets', category: 'Google' },
  { type: 'n8n-nodes-base.googleSheetsTrigger', displayName: 'Google Sheets Trigger', category: 'Google' },
  { type: 'n8n-nodes-base.googleDrive', displayName: 'Google Drive', category: 'Google' },
  { type: 'n8n-nodes-base.googleDriveTrigger', displayName: 'Google Drive Trigger', category: 'Google' },
  { type: 'n8n-nodes-base.googleDocs', displayName: 'Google Docs', category: 'Google' },
  { type: 'n8n-nodes-base.googleCalendar', displayName: 'Google Calendar', category: 'Google' },
  { type: 'n8n-nodes-base.googleCalendarTrigger', displayName: 'Google Calendar Trigger', category: 'Google' },
  { type: 'n8n-nodes-base.googleSlides', displayName: 'Google Slides', category: 'Google' },
  { type: 'n8n-nodes-base.googleTasks', displayName: 'Google Tasks', category: 'Google' },
  { type: 'n8n-nodes-base.googleBigQuery', displayName: 'Google BigQuery', category: 'Google' },
  { type: 'n8n-nodes-base.googleCloudStorage', displayName: 'Google Cloud Storage', category: 'Google' },
  { type: 'n8n-nodes-base.googleAnalytics', displayName: 'Google Analytics', category: 'Google' },
  { type: 'n8n-nodes-base.youtube', displayName: 'YouTube', category: 'Google' },

  // === DATABASE & STORAGE ===
  { type: 'n8n-nodes-base.postgres', displayName: 'Postgres', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.postgresTrigger', displayName: 'Postgres Trigger', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.mySql', displayName: 'MySQL', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.mongoDb', displayName: 'MongoDB', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.redis', displayName: 'Redis', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.elasticsearch', displayName: 'Elasticsearch', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.airtable', displayName: 'Airtable', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.airtableTrigger', displayName: 'Airtable Trigger', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.notion', displayName: 'Notion', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.notionTrigger', displayName: 'Notion Trigger', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.supabase', displayName: 'Supabase', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.dynamoDb', displayName: 'DynamoDB', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.microsoftSql', displayName: 'Microsoft SQL', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.snowflake', displayName: 'Snowflake', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.baserow', displayName: 'Baserow', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.noCoDB', displayName: 'NocoDB', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.s3', displayName: 'AWS S3', category: 'Database & Storage' },
  { type: 'n8n-nodes-base.awsS3', displayName: 'AWS S3', category: 'Database & Storage' },

  // === CRM & SALES ===
  { type: 'n8n-nodes-base.hubspot', displayName: 'HubSpot', category: 'CRM & Sales' },
  { type: 'n8n-nodes-base.hubspotTrigger', displayName: 'HubSpot Trigger', category: 'CRM & Sales' },
  { type: 'n8n-nodes-base.salesforce', displayName: 'Salesforce', category: 'CRM & Sales' },
  { type: 'n8n-nodes-base.pipedrive', displayName: 'Pipedrive', category: 'CRM & Sales' },
  { type: 'n8n-nodes-base.pipedriveTrigger', displayName: 'Pipedrive Trigger', category: 'CRM & Sales' },
  { type: 'n8n-nodes-base.zoho', displayName: 'Zoho CRM', category: 'CRM & Sales' },
  { type: 'n8n-nodes-base.copper', displayName: 'Copper', category: 'CRM & Sales' },
  { type: 'n8n-nodes-base.freshdesk', displayName: 'Freshdesk', category: 'CRM & Sales' },
  { type: 'n8n-nodes-base.intercom', displayName: 'Intercom', category: 'CRM & Sales' },
  { type: 'n8n-nodes-base.zendesk', displayName: 'Zendesk', category: 'CRM & Sales' },
  { type: 'n8n-nodes-base.zendeskTrigger', displayName: 'Zendesk Trigger', category: 'CRM & Sales' },

  // === PRODUCTIVITY ===
  { type: 'n8n-nodes-base.trello', displayName: 'Trello', category: 'Productivity' },
  { type: 'n8n-nodes-base.trelloTrigger', displayName: 'Trello Trigger', category: 'Productivity' },
  { type: 'n8n-nodes-base.asana', displayName: 'Asana', category: 'Productivity' },
  { type: 'n8n-nodes-base.asanaTrigger', displayName: 'Asana Trigger', category: 'Productivity' },
  { type: 'n8n-nodes-base.clickUp', displayName: 'ClickUp', category: 'Productivity' },
  { type: 'n8n-nodes-base.clickUpTrigger', displayName: 'ClickUp Trigger', category: 'Productivity' },
  { type: 'n8n-nodes-base.jira', displayName: 'Jira', category: 'Productivity' },
  { type: 'n8n-nodes-base.jiraTrigger', displayName: 'Jira Trigger', category: 'Productivity' },
  { type: 'n8n-nodes-base.todoist', displayName: 'Todoist', category: 'Productivity' },
  { type: 'n8n-nodes-base.linear', displayName: 'Linear', category: 'Productivity' },
  { type: 'n8n-nodes-base.linearTrigger', displayName: 'Linear Trigger', category: 'Productivity' },
  { type: 'n8n-nodes-base.monday', displayName: 'Monday.com', category: 'Productivity' },

  // === DEVELOPER TOOLS ===
  { type: 'n8n-nodes-base.github', displayName: 'GitHub', category: 'Developer Tools' },
  { type: 'n8n-nodes-base.githubTrigger', displayName: 'GitHub Trigger', category: 'Developer Tools' },
  { type: 'n8n-nodes-base.gitlab', displayName: 'GitLab', category: 'Developer Tools' },
  { type: 'n8n-nodes-base.gitlabTrigger', displayName: 'GitLab Trigger', category: 'Developer Tools' },
  { type: 'n8n-nodes-base.bitbucket', displayName: 'Bitbucket', category: 'Developer Tools' },
  { type: 'n8n-nodes-base.bitbucketTrigger', displayName: 'Bitbucket Trigger', category: 'Developer Tools' },
  { type: 'n8n-nodes-base.sentry', displayName: 'Sentry', category: 'Developer Tools' },
  { type: 'n8n-nodes-base.sentryIo', displayName: 'Sentry.io', category: 'Developer Tools' },

  // === E-COMMERCE ===
  { type: 'n8n-nodes-base.shopify', displayName: 'Shopify', category: 'E-Commerce' },
  { type: 'n8n-nodes-base.shopifyTrigger', displayName: 'Shopify Trigger', category: 'E-Commerce' },
  { type: 'n8n-nodes-base.wooCommerce', displayName: 'WooCommerce', category: 'E-Commerce' },
  { type: 'n8n-nodes-base.wooCommerceTrigger', displayName: 'WooCommerce Trigger', category: 'E-Commerce' },
  { type: 'n8n-nodes-base.stripe', displayName: 'Stripe', category: 'E-Commerce' },
  { type: 'n8n-nodes-base.stripeTrigger', displayName: 'Stripe Trigger', category: 'E-Commerce' },

  // === CMS ===
  { type: 'n8n-nodes-base.wordpress', displayName: 'WordPress', category: 'CMS' },
  { type: 'n8n-nodes-base.contentful', displayName: 'Contentful', category: 'CMS' },
  { type: 'n8n-nodes-base.strapi', displayName: 'Strapi', category: 'CMS' },
  { type: 'n8n-nodes-base.ghost', displayName: 'Ghost', category: 'CMS' },

  // === AI / LANGCHAIN ===
  { type: '@n8n/n8n-nodes-langchain.agent', displayName: 'AI Agent', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.chainLlm', displayName: 'Basic LLM Chain', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.chainSummarization', displayName: 'Summarization Chain', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.chainRetrievalQa', displayName: 'Question and Answer Chain', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.lmChatOpenAi', displayName: 'OpenAI Chat Model', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', displayName: 'Google Gemini Chat Model', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.lmChatAnthropic', displayName: 'Anthropic Chat Model', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.lmChatAzureOpenAi', displayName: 'Azure OpenAI Chat Model', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.lmChatOllama', displayName: 'Ollama Chat Model', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.lmChatOpenRouter', displayName: 'OpenRouter Chat Model', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.lmChatGroq', displayName: 'Groq Chat Model', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.lmChatMistralCloud', displayName: 'Mistral Cloud Chat Model', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.openAi', displayName: 'OpenAI', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.embeddingsOpenAi', displayName: 'Embeddings OpenAI', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.embeddingsGoogleGemini', displayName: 'Embeddings Google Gemini', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.memoryBufferWindow', displayName: 'Simple Memory', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.memoryPostgresChat', displayName: 'Postgres Chat Memory', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.memoryRedisChat', displayName: 'Redis Chat Memory', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.outputParserStructured', displayName: 'Structured Output Parser', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.outputParserAutofixing', displayName: 'Auto-fixing Output Parser', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterTextSplitter', displayName: 'Recursive Character Text Splitter', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.textSplitterTokenSplitter', displayName: 'Token Splitter', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.documentDefaultDataLoader', displayName: 'Default Data Loader', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.vectorStorePinecone', displayName: 'Pinecone Vector Store', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.vectorStoreQdrant', displayName: 'Qdrant Vector Store', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.vectorStoreSupabase', displayName: 'Supabase Vector Store', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.vectorStoreInMemory', displayName: 'In-Memory Vector Store', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.toolCalculator', displayName: 'Calculator', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.toolCode', displayName: 'Code Tool', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.toolWorkflow', displayName: 'Call n8n Workflow Tool', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.toolWikipedia', displayName: 'Wikipedia', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.toolSerpApi', displayName: 'SerpAPI', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.informationExtractor', displayName: 'Information Extractor', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.textClassifier', displayName: 'Text Classifier', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.sentimentAnalysis', displayName: 'Sentiment Analysis', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.mcpClientTool', displayName: 'MCP Client Tool', category: 'AI' },
  { type: '@n8n/n8n-nodes-langchain.toolThink', displayName: 'Think Tool', category: 'AI' },

  // === MARKETING & ANALYTICS ===
  { type: 'n8n-nodes-base.activeCampaign', displayName: 'ActiveCampaign', category: 'Marketing' },
  { type: 'n8n-nodes-base.convertKit', displayName: 'ConvertKit', category: 'Marketing' },
  { type: 'n8n-nodes-base.lemlist', displayName: 'Lemlist', category: 'Marketing' },
  { type: 'n8n-nodes-base.mautic', displayName: 'Mautic', category: 'Marketing' },
  { type: 'n8n-nodes-base.segment', displayName: 'Segment', category: 'Marketing' },
  { type: 'n8n-nodes-base.customerIo', displayName: 'Customer.io', category: 'Marketing' },

  // === OTHER INTEGRATIONS ===
  { type: 'n8n-nodes-base.microsoftOneDrive', displayName: 'Microsoft OneDrive', category: 'Other' },
  { type: 'n8n-nodes-base.microsoftOutlook', displayName: 'Microsoft Outlook', category: 'Other' },
  { type: 'n8n-nodes-base.dropbox', displayName: 'Dropbox', category: 'Other' },
  { type: 'n8n-nodes-base.box', displayName: 'Box', category: 'Other' },
  { type: 'n8n-nodes-base.googleForms', displayName: 'Google Forms', category: 'Other' },
  { type: 'n8n-nodes-base.typeform', displayName: 'Typeform', category: 'Other' },
  { type: 'n8n-nodes-base.typeformTrigger', displayName: 'Typeform Trigger', category: 'Other' },
  { type: 'n8n-nodes-base.calendly', displayName: 'Calendly', category: 'Other' },
  { type: 'n8n-nodes-base.calendlyTrigger', displayName: 'Calendly Trigger', category: 'Other' },
  { type: 'n8n-nodes-base.zapier', displayName: 'Zapier', category: 'Other' },
  { type: 'n8n-nodes-base.awsLambda', displayName: 'AWS Lambda', category: 'Other' },
  { type: 'n8n-nodes-base.openWeatherMap', displayName: 'OpenWeatherMap', category: 'Other' },
];

interface NodeData {
  type: string;
  displayName: string;
  category: string;
  count: number;
  percentage: number;
}

interface AllNodesData {
  lastUpdated: string;
  fetchDuration: number;
  totalTemplates: number;
  nodes: {
    total: number;
    withData: number;
    byCategory: Record<string, NodeData[]>;
    all: NodeData[];
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchNodeCount(nodeType: string): Promise<number> {
  const url = `${API_BASE}?rows=1&nodes=${encodeURIComponent(nodeType)}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'n8n-stats' },
    });

    if (!response.ok) {
      console.warn(`  Warning: API error for ${nodeType}: ${response.status}`);
      return 0;
    }

    const data = await response.json();
    return data.totalWorkflows || 0;
  } catch (error) {
    console.warn(`  Warning: Failed to fetch ${nodeType}:`, error);
    return 0;
  }
}

async function fetchTotalTemplates(): Promise<number> {
  const response = await fetch(`${API_BASE}?rows=1`, {
    headers: { 'User-Agent': 'n8n-stats' },
  });
  const data = await response.json();
  return data.totalWorkflows || 0;
}

async function main() {
  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('n8n All Nodes Data Fetch');
  console.log('='.repeat(60));
  console.log();

  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Get total templates count
  const totalTemplates = await fetchTotalTemplates();
  console.log(`Total templates: ${totalTemplates.toLocaleString()}\n`);

  // Fetch counts for all nodes
  console.log(`Fetching counts for ${KNOWN_NODES.length} nodes...\n`);

  const nodeData: NodeData[] = [];
  let processed = 0;

  for (const node of KNOWN_NODES) {
    await sleep(RATE_LIMIT_DELAY);

    const count = await fetchNodeCount(node.type);
    const percentage = totalTemplates > 0 ? Math.round((count / totalTemplates) * 1000) / 10 : 0;

    nodeData.push({
      type: node.type,
      displayName: node.displayName,
      category: node.category,
      count,
      percentage,
    });

    processed++;
    if (processed % 20 === 0 || processed === KNOWN_NODES.length) {
      process.stdout.write(`\rProgress: ${processed}/${KNOWN_NODES.length} nodes (${Math.round(processed/KNOWN_NODES.length*100)}%)`);
    }
  }

  console.log('\n');

  // Sort by count descending
  nodeData.sort((a, b) => b.count - a.count);

  // Group by category
  const byCategory: Record<string, NodeData[]> = {};
  for (const node of nodeData) {
    if (!byCategory[node.category]) {
      byCategory[node.category] = [];
    }
    byCategory[node.category].push(node);
  }

  // Sort each category by count
  for (const category of Object.keys(byCategory)) {
    byCategory[category].sort((a, b) => b.count - a.count);
  }

  const nodesWithData = nodeData.filter(n => n.count > 0).length;
  const fetchDuration = Math.round((Date.now() - startTime) / 1000);

  // Build output data
  const data: AllNodesData = {
    lastUpdated: new Date().toISOString(),
    fetchDuration,
    totalTemplates,
    nodes: {
      total: nodeData.length,
      withData: nodesWithData,
      byCategory,
      all: nodeData,
    },
  };

  // Print summary
  console.log('Summary by category:');
  const categoryTotals = Object.entries(byCategory)
    .map(([cat, nodes]) => ({
      category: cat,
      count: nodes.length,
      withData: nodes.filter(n => n.count > 0).length,
      totalUsage: nodes.reduce((sum, n) => sum + n.count, 0),
    }))
    .sort((a, b) => b.totalUsage - a.totalUsage);

  for (const cat of categoryTotals) {
    console.log(`  ${cat.category}: ${cat.withData}/${cat.count} nodes, ${cat.totalUsage.toLocaleString()} total usages`);
  }

  // Save to file
  writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
  console.log(`\nSaved to ${OUTPUT_PATH}`);
  console.log(`Completed in ${fetchDuration} seconds`);
  console.log(`Nodes with data: ${nodesWithData}/${nodeData.length}`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
