import React, { useState, useEffect } from 'react';
import ForgeReconciler, { 
  Text, 
  Button, 
  Stack, 
  Strong, 
  Spinner, 
  EmptyState,
  Inline,
  Box,
  User,
  SectionMessage,
  xcss
} from '@forge/react';
import { invoke } from '@forge/bridge';

const CommentsList = () => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('created'); // 'created' = oldest first, '-created' = newest first
  const [issueKey, setIssueKey] = useState(null);
  const [error, setError] = useState(null);

  // Get issue context on component mount
  useEffect(() => {
    const getIssueContext = async () => {
      try {
        const contextResult = await invoke('getIssueContext');
        if (contextResult.success && contextResult.issueKey) {
          setIssueKey(contextResult.issueKey);
        } else {
          setError('Unable to get issue context');
        }
      } catch (err) {
        console.error('Failed to get issue context:', err);
        setError('Failed to load issue context');
      }
    };
    getIssueContext();
  }, []);

  // Fetch comments when issue key or sort order changes
  useEffect(() => {
    if (!issueKey) return;
    
    const fetchComments = async () => {
      setLoading(true);
      try {
        const result = await invoke('getIssueComments', { 
          issueKey, 
          sortOrder 
        });
        
        if (result.success) {
          setComments(result.comments || []);
          setError(null);
        } else {
          setError(result.error || 'Failed to load comments');
          setComments([]);
        }
      } catch (err) {
        console.error('Failed to fetch comments:', err);
        setError('Failed to load comments');
        setComments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [issueKey, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder(current => current === 'created' ? '-created' : 'created');
  };


  // Improved date formatting with Intl.DateTimeFormat
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${dateFormatter.format(date)} at ${timeFormatter.format(date)}`;
  };


  const extractTextFromAdf = (adfContent) => {
    if (!adfContent || !adfContent.content) return '';
    
    let text = '';
    const extractText = (node) => {
      if (node.type === 'text') {
        text += node.text || '';
      } else if (node.type === 'hardBreak') {
        text += '\n';
      } else if (node.type === 'paragraph') {
        if (node.content) {
          node.content.forEach(extractText);
          text += '\n\n';
        }
      } else if (node.content) {
        node.content.forEach(extractText);
      }
    };
    
    adfContent.content.forEach(extractText);
    return text.trim();
  };


  if (loading) {
    return (
      <Stack space="space.200" alignInline="center">
        <Spinner size="large" />
        <Text>Loading comments...</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <SectionMessage appearance="error">
        <Text><Strong>Error:</Strong> {error}</Text>
      </SectionMessage>
    );
  }

  if (comments.length === 0) {
    return (
      <EmptyState
        header="No comments found"
        description="This issue doesn't have any comments yet."
      />
    );
  }

  return (
    <Stack space="space.300">
      {/* Header with sort control */}
      <Inline space="space.200" alignBlock="center" spread="space-between">
        <Text><Strong>{comments.length}</Strong> comments</Text>
        <Button 
          appearance="subtle" 
          onClick={toggleSortOrder}
        >
          {sortOrder === 'created' ? 'Oldest First' : 'Newest First'}
        </Button>
      </Inline>

      {/* Comments list */}
      {comments.map((comment, index) => {
        const commentText = extractTextFromAdf(comment.body);
        return (
          <Stack key={comment.id} space="space.200">
            {/* Comment header - author and date on same line */}
            <Inline space="space.100" alignBlock="start">
              <User accountId={comment.author?.accountId} />
              <Text>added a comment - {formatDate(comment.created)}</Text>
            </Inline>

            {/* Comment content with formatting */}
            <Box>
              <Text>
                {commentText || 'No content'}
              </Text>
            </Box>
            
            {/* Add separator after each comment except the last one */}
            {index < comments.length - 1 && (
              <Box
                xcss={xcss({
                  borderBottom: '1px solid',
                  borderColor: 'color.border',
                  borderStyle: 'solid',
                  marginTop: 'space.200'
                })}
              />
            )}
          </Stack>
        );
      })}
    </Stack>
  );
};

ForgeReconciler.render(<CommentsList />);
