#!/usr/bin/env python3
"""
Simple Jupyter Kernel Execution Server
This is a simpler alternative to Jupyter Kernel Gateway for local development.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import io
import traceback
from contextlib import redirect_stdout, redirect_stderr
import base64
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt

app = Flask(__name__)
CORS(app)

# Global namespace for code execution (persists between requests)
global_namespace = {'__name__': '__main__'}

@app.route('/api/execute', methods=['POST'])
def execute_code():
    """Execute Python code and return outputs"""
    try:
        data = request.get_json()
        code = data.get('code', '')
        
        if not code:
            return jsonify({'error': 'No code provided'}), 400
        
        # Capture stdout and stderr
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        outputs = []
        
        try:
            # Redirect stdout/stderr
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                # Execute the code
                exec(code, global_namespace)
                
                # Check if matplotlib has any figures
                figures = [plt.figure(n) for n in plt.get_fignums()]
                for fig in figures:
                    # Save figure to bytes
                    img_buffer = io.BytesIO()
                    fig.savefig(img_buffer, format='png', bbox_inches='tight')
                    img_buffer.seek(0)
                    img_base64 = base64.b64encode(img_buffer.read()).decode()
                    
                    outputs.append({
                        'output_type': 'display_data',
                        'data': {
                            'image/png': img_base64
                        }
                    })
                    plt.close(fig)
            
            # Get captured output
            stdout_text = stdout_capture.getvalue()
            stderr_text = stderr_capture.getvalue()
            
            if stdout_text:
                outputs.append({
                    'output_type': 'stream',
                    'name': 'stdout',
                    'text': stdout_text
                })
            
            if stderr_text:
                outputs.append({
                    'output_type': 'stream',
                    'name': 'stderr',
                    'text': stderr_text
                })
            
            return jsonify({
                'success': True,
                'outputs': outputs
            })
            
        except Exception as e:
            # Get traceback
            tb = traceback.format_exc()
            
            return jsonify({
                'success': False,
                'error': {
                    'name': type(e).__name__,
                    'message': str(e),
                    'traceback': tb.split('\n')
                },
                'outputs': []
            })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    print("🚀 Simple Jupyter Execution Server starting...")
    print("📡 Listening on http://0.0.0.0:8888")
    app.run(host='0.0.0.0', port=8888, debug=False)
