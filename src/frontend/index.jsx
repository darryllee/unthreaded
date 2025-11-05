import React, { useState, useEffect, useMemo } from 'react';
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
  ButtonGroup,
  SectionMessage,
  Textfield,
  Select,
  DatePicker,
  Heading,
  xcss
} from '@forge/react';
import { invoke } from '@forge/bridge';

const cardStyle = xcss({
  backgroundColor: 'elevation.surface',
  padding: 'space.200',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'border.radius',
  marginBottom: 'space.100'
});

const CommentsList = () => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('created'); // 'created' = oldest first, '-created' = newest first
  const [issueKey, setIssueKey] = useState(null);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  
  // Filter and search states
  const [searchTermInput, setSearchTermInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState('all');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  
  // Collapsible panel states
  const [showStats, setShowStats] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchTermInput.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTermInput]);

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
          setTotal(result.total || 0);
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

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(date);
    } catch (e) {
      return dateString;
    }
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

  const formatTextWithFormatting = (adfContent) => {
    if (!adfContent || !adfContent.content) return null;
    
    let elements = [];
    let key = 0;
    
    const processNode = (node) => {
      if (node.type === 'text') {
        let text = node.text || '';
        
        // Highlight search terms
        if (searchTerm && text.toLowerCase().includes(searchTerm.toLowerCase())) {
          const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          const parts = text.split(regex);
          const highlightedParts = parts.map((part, index) => {
            if (part.toLowerCase() === searchTerm.toLowerCase()) {
              return <Strong key={`${key++}-${index}`}>{part}</Strong>;
            }
            return <Text key={`${key++}-${index}`}>{part}</Text>;
          });
          
          // Apply text formatting to highlighted parts
          if (node.marks && node.marks.length > 0) {
            return node.marks.reduce((acc, mark) => {
              if (mark.type === 'strong') {
                return <Strong key={key++}>{acc}</Strong>;
              } else if (mark.type === 'em') {
                return <Text key={key++} appearance="subtle">{acc}</Text>;
              } else if (mark.type === 'code') {
                return <Text key={key++} appearance="subtle">{acc}</Text>;
              }
              return acc;
            }, <>{highlightedParts}</>);
          }
          return <>{highlightedParts}</>;
        }
        
        // Apply text formatting without highlighting
        let formattedText = text;
        if (node.marks) {
          formattedText = node.marks.reduce((acc, mark) => {
            if (mark.type === 'strong') {
              return <Strong key={key++}>{acc}</Strong>;
            } else if (mark.type === 'em') {
              return <Text key={key++} appearance="subtle">{acc}</Text>;
            } else if (mark.type === 'code') {
              return <Text key={key++} appearance="subtle">{acc}</Text>;
            }
            return acc;
          }, text);
        }
        
        return formattedText;
      } else if (node.type === 'hardBreak') {
        return <Text key={key++}>{'\n'}</Text>;
      } else if (node.type === 'paragraph') {
        if (node.content) {
          const content = node.content.map(processNode).flat();
          elements.push(<Text key={key++}>{content}</Text>);
        }
      } else if (node.content) {
        return node.content.map(processNode).flat();
      }
      return null;
    };
    
    adfContent.content.forEach(processNode);
    return elements.length > 0 ? elements : null;
  };

  // Get unique authors for filter dropdown
  const authors = useMemo(() => {
    const uniqueAuthors = new Set();
    comments.forEach(comment => {
      if (comment.author?.displayName) {
        uniqueAuthors.add(JSON.stringify({
          accountId: comment.author.accountId,
          displayName: comment.author.displayName
        }));
      }
    });
    return Array.from(uniqueAuthors).map(author => JSON.parse(author));
  }, [comments]);

  // Filter and search comments
  const filteredComments = useMemo(() => {
    return comments.filter(comment => {
      // Search term filter
      if (searchTerm) {
        const commentText = extractTextFromAdf(comment.body).toLowerCase();
        const renderedText = comment.renderedBody ? 
          comment.renderedBody.replace(/<[^>]*>/g, '').toLowerCase() : '';
        const authorName = comment.author?.displayName?.toLowerCase() || '';
        
        const searchLower = searchTerm.toLowerCase();
        if (!commentText.includes(searchLower) && 
            !renderedText.includes(searchLower) && 
            !authorName.includes(searchLower)) {
          return false;
        }
      }

      // Author filter
      if (selectedAuthor !== 'all' && comment.author?.accountId !== selectedAuthor) {
        return false;
      }

      // Date range filter
      const commentDate = new Date(comment.created);
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (commentDate < fromDate) return false;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        if (commentDate > toDate) return false;
      }

      return true;
    });
  }, [comments, searchTerm, selectedAuthor, dateFrom, dateTo]);

  // Calculate statistics
  const stats = useMemo(() => {
    const authorCounts = {};
    const totalWords = filteredComments.reduce((total, comment) => {
      const author = comment.author?.displayName || 'Unknown';
      authorCounts[author] = (authorCounts[author] || 0) + 1;
      
      const text = extractTextFromAdf(comment.body);
      return total + text.split(/\s+/).filter(word => word.length > 0).length;
    }, 0);

    const avgWordsPerComment = filteredComments.length > 0 ? 
      Math.round(totalWords / filteredComments.length) : 0;

    return {
      totalComments: filteredComments.length,
      totalWords,
      avgWordsPerComment,
      authorCounts,
      topAuthor: Object.entries(authorCounts).sort((a, b) => b[1] - a[1])[0]
    };
  }, [filteredComments]);

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
      {/* Statistics Panel */}
      <Box xcss={cardStyle}>
        <Stack space="space.200">
          <Inline space="space.200" alignBlock="center">
            <Heading size="small">Comment Statistics</Heading>
            <Button 
              appearance="subtle" 
              onClick={() => setShowStats(!showStats)}
            >
              {showStats ? 'Hide' : 'Show'}
            </Button>
          </Inline>
          {showStats && (
            <Inline space="space.300" spread="space-between">
              <Stack space="space.050">
                <Text size="small"><Strong>{stats.totalComments}</Strong> comments shown</Text>
                <Text size="small">({total} total)</Text>
              </Stack>
              <Stack space="space.050">
                <Text size="small"><Strong>{stats.totalWords}</Strong> total words</Text>
                <Text size="small">~{stats.avgWordsPerComment} words/comment</Text>
              </Stack>
              {stats.topAuthor && (
                <Stack space="space.050">
                  <Text size="small">Most active: <Strong>{stats.topAuthor[0]}</Strong></Text>
                  <Text size="small">{stats.topAuthor[1]} comments</Text>
                </Stack>
              )}
            </Inline>
          )}
        </Stack>
      </Box>

      {/* Search and Filter Controls */}
      <Box xcss={cardStyle}>
        <Stack space="space.200">
          <Inline space="space.200" alignBlock="center">
            <Heading size="small">Search & Filter</Heading>
            <Button 
              appearance="subtle" 
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? 'Hide' : 'Show'}
            </Button>
            {(searchTermInput || selectedAuthor !== 'all' || dateFrom || dateTo) && (
              <Text size="small" appearance="subtle">
                (filters active)
              </Text>
            )}
          </Inline>
          
          {showFilters && (
            <Stack space="space.200">
              {/* Search */}
              <Textfield
                name="search"
                placeholder="Search comments, authors, or content..."
                value={searchTermInput}
                onChange={(e) => setSearchTermInput(e.target.value)}
              />
              
              {/* Filter Controls */}
              <Inline space="space.200" alignBlock="center">
                {/* Author Filter */}
                <Stack space="space.050">
                  <Text size="small"><Strong>Author</Strong></Text>
                  <Select
                    value={selectedAuthor}
                    onChange={(e) => setSelectedAuthor(e.target.value)}
                  >
                    <option value="all">All authors</option>
                    {authors.map(author => (
                      <option key={author.accountId} value={author.accountId}>
                        {author.displayName}
                      </option>
                    ))}
                  </Select>
                </Stack>

                {/* Date Range */}
                <Stack space="space.050">
                  <Text size="small"><Strong>From Date</Strong></Text>
                  <DatePicker
                    value={dateFrom}
                    onChange={(date) => setDateFrom(date)}
                  />
                </Stack>
                
                <Stack space="space.050">
                  <Text size="small"><Strong>To Date</Strong></Text>
                  <DatePicker
                    value={dateTo}
                    onChange={(date) => setDateTo(date)}
                  />
                </Stack>

                {/* Clear Filters */}
                <Button
                  appearance="subtle"
                  onClick={() => {
                    setSearchTermInput('');
                    setSearchTerm('');
                    setSelectedAuthor('all');
                    setDateFrom(null);
                    setDateTo(null);
                  }}
                >
                  Clear All
                </Button>
              </Inline>
            </Stack>
          )}
        </Stack>
      </Box>

      {/* Header with sort controls */}
      <Stack space="space.200">
        <Inline space="space.200" alignBlock="center">
          <Text>
            <Strong>Comments ({stats.totalComments} shown)</Strong>
          </Text>
          <ButtonGroup>
            <Button 
              appearance={sortOrder === 'created' ? 'primary' : 'default'}
              onClick={() => setSortOrder('created')}
            >
              Oldest First
            </Button>
            <Button 
              appearance={sortOrder === '-created' ? 'primary' : 'default'}
              onClick={() => setSortOrder('-created')}
            >
              Newest First
            </Button>
          </ButtonGroup>
        </Inline>
      </Stack>

      {/* Comments list */}
      {filteredComments.map((comment, index) => (
        <Stack key={comment.id} space="space.200">
          {/* Comment header - author and date on same line */}
          <Inline space="space.100" alignBlock="start">
            <User accountId={comment.author?.accountId} />
            <Text>added a comment - {formatDate(comment.created)}</Text>
          </Inline>

          {/* Comment content with formatting and search highlighting */}
          <Box>
            {formatTextWithFormatting(comment.body) || (
              <Text>{extractTextFromAdf(comment.body) || 'No content'}</Text>
            )}
          </Box>
          
          {/* Add separator after each comment except the last one */}
          {index < filteredComments.length - 1 && (
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
      ))}

    </Stack>
  );
};

ForgeReconciler.render(<CommentsList />);