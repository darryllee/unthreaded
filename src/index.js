import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

// Get issue comments with chronological sorting
resolver.define('getIssueComments', async (req) => {
  const { issueKey, sortOrder = 'created' } = req.payload;
  
  try {
    // Fetch comments using Jira REST API
    const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/comment?orderBy=${sortOrder}&expand=renderedBody`);
    const data = await response.json();
    
    return {
      success: true,
      comments: data.comments || [],
      total: data.total || 0
    };
  } catch (error) {
    console.error('Error fetching comments:', error);
    return {
      success: false,
      error: error.message,
      comments: [],
      total: 0
    };
  }
});

// Get current issue context
resolver.define('getIssueContext', async (req) => {
  try {
    const context = req.context;
    return {
      success: true,
      issueKey: context?.extension?.issue?.key || null,
      issueId: context?.extension?.issue?.id || null
    };
  } catch (error) {
    console.error('Error getting issue context:', error);
    return {
      success: false,
      error: error.message,
      issueKey: null,
      issueId: null
    };
  }
});

export const handler = resolver.getDefinitions();