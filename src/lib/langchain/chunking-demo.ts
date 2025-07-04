import { TextSplitter } from './text-splitter';

// Sample documents of different sizes
const sampleDocuments = {
  small: "This is a small document with just a few sentences. It contains basic information that doesn't need complex chunking strategies.",
  
  medium: `This is a medium-sized document that contains several paragraphs of content. 
  
  It has multiple sections with different topics and ideas. The content is substantial enough to require thoughtful chunking but not so large that it would overwhelm the system.
  
  This document represents the typical case that most users will encounter in their daily work. It's long enough to benefit from proper text splitting but short enough to process efficiently.`,
  
  large: `This is a large document that contains many paragraphs and sections. It's designed to test the system's ability to handle substantial amounts of text while maintaining semantic coherence.

  The document includes multiple topics and subtopics, with detailed explanations and examples. Each section builds upon the previous one, creating a comprehensive narrative that spans thousands of characters.

  This type of document is common in academic papers, technical documentation, and research reports. It requires careful chunking to ensure that related concepts stay together while avoiding chunks that are too large for effective processing.

  The content includes various types of information: definitions, explanations, examples, and conclusions. Each type of content has different requirements for optimal chunking strategies.

  We also include some technical terminology and specialized language that should be preserved within the same chunks to maintain context and meaning.

  The document structure includes headings, subheadings, and various formatting elements that help organize the content logically.

  Finally, we include some concluding thoughts and summary information that ties together the various themes and topics discussed throughout the document.`.repeat(3), // Make it even larger
  
  academic: `# Research Paper: Advanced Machine Learning Techniques

## Abstract
This paper presents a comprehensive analysis of advanced machine learning techniques, including deep learning, reinforcement learning, and transfer learning. We examine the theoretical foundations, practical applications, and current limitations of these approaches.

## Introduction
Machine learning has evolved significantly over the past decade, with new techniques emerging that push the boundaries of what's possible in artificial intelligence. This research focuses on three key areas: deep learning architectures, reinforcement learning algorithms, and transfer learning methodologies.

## Deep Learning
Deep learning represents a subset of machine learning that uses neural networks with multiple layers to model and understand complex patterns in data. The key innovation of deep learning is its ability to automatically learn hierarchical representations of data.

### Neural Network Architectures
Convolutional Neural Networks (CNNs) are particularly effective for image processing tasks. They use convolutional layers to detect spatial patterns and pooling layers to reduce dimensionality. Recurrent Neural Networks (RNNs) are designed for sequential data and can maintain state information across time steps.

### Training Methods
Backpropagation remains the primary training algorithm for deep neural networks. However, recent advances in optimization techniques, such as Adam and RMSprop, have significantly improved training efficiency and convergence rates.

## Reinforcement Learning
Reinforcement learning is a type of machine learning where an agent learns to make decisions by interacting with an environment. The agent receives rewards or penalties based on its actions and learns to maximize cumulative rewards over time.

### Q-Learning
Q-learning is a model-free reinforcement learning algorithm that learns the quality of actions, telling an agent what action to take under what circumstances. It does not require a model of the environment and can handle problems with stochastic transitions and rewards.

### Policy Gradient Methods
Policy gradient methods directly parameterize the policy and optimize it using gradient ascent. These methods are particularly effective for continuous action spaces and can learn stochastic policies.

## Transfer Learning
Transfer learning enables the application of knowledge learned in one domain to a related domain. This is particularly valuable when labeled data is scarce in the target domain.

### Pre-trained Models
Models pre-trained on large datasets, such as ImageNet for computer vision or BERT for natural language processing, can be fine-tuned for specific tasks with relatively little data.

### Domain Adaptation
Domain adaptation techniques help bridge the gap between source and target domains by learning domain-invariant representations or by adapting the model to the target domain.

## Experimental Results
Our experiments demonstrate the effectiveness of combining these techniques. We achieved state-of-the-art results on several benchmark datasets, with improvements of 15-25% over baseline methods.

### Dataset Description
We evaluated our approach on three datasets: CIFAR-10 for image classification, Penn Treebank for language modeling, and Atari games for reinforcement learning.

### Performance Metrics
We measured performance using accuracy, precision, recall, and F1-score for classification tasks, perplexity for language modeling, and average reward for reinforcement learning tasks.

## Discussion
The results show that combining multiple machine learning techniques can lead to significant performance improvements. However, we also identified several challenges and limitations that need to be addressed in future work.

### Limitations
Current approaches still struggle with interpretability, robustness to adversarial attacks, and generalization to out-of-distribution data. Additionally, the computational requirements for training large models remain substantial.

### Future Work
Future research should focus on developing more efficient training methods, improving model interpretability, and creating more robust algorithms that can handle real-world uncertainties.

## Conclusion
This research demonstrates the potential of advanced machine learning techniques when properly combined and optimized. The results provide a foundation for future work in this area and highlight the importance of continued research in machine learning methodology.

## References
1. LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521(7553), 436-444.
2. Sutton, R. S., & Barto, A. G. (2018). Reinforcement learning: An introduction. MIT press.
3. Pan, S. J., & Yang, Q. (2009). A survey on transfer learning. IEEE Transactions on knowledge and data engineering, 22(10), 1345-1359.`
};

async function demonstrateChunking() {
  console.log('🔧 Dynamic Chunking Strategy Demo\n');
  
  const splitter = new TextSplitter();
  
  for (const [size, text] of Object.entries(sampleDocuments)) {
    console.log(`📄 Testing ${size.toUpperCase()} document (${text.length} characters)`);
    console.log('─'.repeat(50));
    
    try {
      const chunks = await splitter.splitText(text, `demo-${size}`, `${size}-document.txt`);
      
      console.log(`✅ Generated ${chunks.length} chunks`);
      console.log(`📊 Average chunk size: ${Math.round(text.length / chunks.length)} characters`);
      console.log(`📏 Chunk size range: ${Math.min(...chunks.map(c => c.content.length))} - ${Math.max(...chunks.map(c => c.content.length))} characters`);
      
      // Show first chunk preview
      if (chunks.length > 0) {
        const preview = chunks[0].content.substring(0, 100) + '...';
        console.log(`📝 First chunk preview: "${preview}"`);
      }
      
      console.log('');
    } catch (error) {
      console.error(`❌ Error processing ${size} document:`, error);
    }
  }
  
  console.log('🎯 Key Benefits of Dynamic Chunking:');
  console.log('• Automatic optimization based on document size');
  console.log('• API limit compliance (prevents batch violations)');
  console.log('• Cost efficiency (balances chunk count vs quality)');
  console.log('• Semantic coherence (maintains meaningful context)');
  console.log('• No manual tuning required');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateChunking().catch(console.error);
}

export { demonstrateChunking }; 