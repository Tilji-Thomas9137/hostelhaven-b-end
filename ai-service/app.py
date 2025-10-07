#!/usr/bin/env python3
"""
HostelHaven AI Microservice
Simple sentiment analysis using VADER sentiment analyzer
"""

from flask import Flask, request, jsonify
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Initialize VADER sentiment analyzer
analyzer = SentimentIntensityAnalyzer()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'hostelhaven-ai',
        'version': '1.0.0'
    })

@app.route('/analyze', methods=['POST'])
def analyze_sentiment():
    """Analyze sentiment of text input"""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({
                'error': 'Missing text field in request body'
            }), 400
        
        text = data['text'].strip()
        
        if not text:
            return jsonify({
                'error': 'Text cannot be empty'
            }), 400
        
        # Get sentiment scores
        scores = analyzer.polarity_scores(text)
        
        # Determine sentiment label based on compound score
        compound_score = scores['compound']
        
        if compound_score >= 0.05:
            sentiment = 'positive'
        elif compound_score <= -0.05:
            sentiment = 'negative'
        else:
            sentiment = 'neutral'
        
        logger.info(f"Analyzed text: '{text[:50]}...' - Sentiment: {sentiment} (score: {compound_score:.3f})")
        
        return jsonify({
            'text': text,
            'sentiment': sentiment,
            'score': round(compound_score, 3),
            'scores': {
                'positive': round(scores['pos'], 3),
                'neutral': round(scores['neu'], 3),
                'negative': round(scores['neg'], 3),
                'compound': round(scores['compound'], 3)
            }
        })
        
    except Exception as e:
        logger.error(f"Error analyzing sentiment: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@app.route('/batch-analyze', methods=['POST'])
def batch_analyze():
    """Analyze sentiment of multiple texts"""
    try:
        data = request.get_json()
        
        if not data or 'texts' not in data:
            return jsonify({
                'error': 'Missing texts field in request body'
            }), 400
        
        texts = data['texts']
        
        if not isinstance(texts, list):
            return jsonify({
                'error': 'Texts must be a list'
            }), 400
        
        results = []
        
        for i, text in enumerate(texts):
            if not isinstance(text, str) or not text.strip():
                results.append({
                    'index': i,
                    'error': 'Invalid text input'
                })
                continue
            
            text = text.strip()
            scores = analyzer.polarity_scores(text)
            compound_score = scores['compound']
            
            if compound_score >= 0.05:
                sentiment = 'positive'
            elif compound_score <= -0.05:
                sentiment = 'negative'
            else:
                sentiment = 'neutral'
            
            results.append({
                'index': i,
                'text': text,
                'sentiment': sentiment,
                'score': round(compound_score, 3),
                'scores': {
                    'positive': round(scores['pos'], 3),
                    'neutral': round(scores['neu'], 3),
                    'negative': round(scores['neg'], 3),
                    'compound': round(scores['compound'], 3)
                }
            })
        
        logger.info(f"Batch analyzed {len(texts)} texts")
        
        return jsonify({
            'results': results,
            'total': len(texts)
        })
        
    except Exception as e:
        logger.error(f"Error in batch analysis: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Endpoint not found'
    }), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({
        'error': 'Method not allowed'
    }), 405

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting HostelHaven AI Service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
