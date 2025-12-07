# 🚀 Jupyter Notebook Integration Guide

## Overview

This guide explains how to integrate Jupyter notebook execution into your AI chatbot, allowing the LLM to generate and execute Python code in a real Jupyter environment.

---

## 🏗️ Architecture

### Complete Flow:

```
User: "Analyze this CSV data and create a bar chart"
    ↓
AI Model (Gemini 2.5 Pro):
    - Receives: system prompt + user question + data context
    - Generates: Python code using pandas, matplotlib
    - Calls: executeNotebook tool
    ↓
Backend API (/api/jupyter/execute):
    - Receives Python code from AI
    - Sends to Jupyter Kernel Gateway
    - Waits for execution results
    ↓
Jupyter Kernel (Docker Container):
    - Executes code in isolated environment
    - Captures outputs (text, plots, errors)
    - Returns results as JSON
    ↓
Frontend (Notebook Artifact):
    - Displays code in CodeMirror editor
    - Shows outputs (text, images, tables)
    - Streams results in real-time
```

---

## 📦 Components

### 1. **Jupyter Kernel Backend** (Docker)
   - Runs Jupyter Kernel Gateway
   - Executes Python code
   - Isolated environment

### 2. **Next.js API Routes** (Your app)
   - `/api/jupyter/execute` - Execute code
   - `/api/jupyter/kernel` - Manage kernels
   
### 3. **AI Tool** (executeNotebook)
   - LLM calls this to run Python
   - Integrated with Vercel AI SDK

### 4. **Frontend Artifact** (notebook)
   - Displays code + outputs
   - Interactive notebook UI

---

## 🔧 Implementation Steps

### Step 1: Setup Jupyter Kernel Gateway

#### Option A: Docker (Recommended for Production)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  jupyter-kernel:
    image: jupyter/base-notebook:latest
    command: >
      jupyter kernelgateway
        --KernelGatewayApp.ip=0.0.0.0
        --KernelGatewayApp.port=8888
        --KernelGatewayApp.auth_token=your-secret-token-here
    ports:
      - "8888:8888"
    volumes:
      - ./jupyter_workspace:/home/jovyan/work
    environment:
      - JUPYTER_ENABLE_LAB=yes
    restart: unless-stopped
```

Run: `docker-compose up -d`

#### Option B: Local Development

```bash
pip install jupyter_kernel_gateway
jupyter kernelgateway --KernelGatewayApp.ip=0.0.0.0 --KernelGatewayApp.port=8888
```

### Step 2: Install Node.js Dependencies

```bash
pnpm add ws axios
```

### Step 3: Configure Environment Variables

Add to `.env.local`:

```bash
JUPYTER_KERNEL_GATEWAY_URL=http://localhost:8888
JUPYTER_AUTH_TOKEN=your-secret-token-here
```

---

## 🛡️ Production Deployment

### Architecture Options:

#### Option 1: Same Server (Simple)
```
[Your Next.js App] ← → [Jupyter Kernel Gateway Docker]
```

#### Option 2: Separate Service (Scalable)
```
[Your Next.js App] ← HTTP → [Jupyter Service] 
                              └─ [Multiple Kernel Containers]
```

#### Option 3: Cloud Provider
- **AWS SageMaker** - Managed Jupyter notebooks
- **Google Colab API** - Google's infrastructure
- **Azure ML** - Microsoft's notebook service

### Security Considerations:

1. **Authentication**: Use auth tokens for kernel gateway
2. **Sandboxing**: Run kernels in isolated Docker containers
3. **Resource Limits**: Set CPU/memory limits per kernel
4. **Timeout**: Kill long-running executions (60s max)
5. **Rate Limiting**: Limit executions per user
6. **Code Validation**: Sanitize/validate code before execution

### Scaling:

1. **Kernel Pool**: Pre-start multiple kernels
2. **Load Balancing**: Distribute across multiple kernel servers
3. **Caching**: Cache common computation results
4. **Async Execution**: Use message queues for long tasks

---

## 💰 Cost Estimation (Production)

### Self-Hosted (AWS/GCP/Azure):

**Small Scale** (< 100 users):
- VM: $50/month (2 vCPU, 8GB RAM)
- Storage: $10/month
- **Total: ~$60/month**

**Medium Scale** (100-1000 users):
- VM Pool: $200/month (4x instances)
- Load Balancer: $20/month
- Storage: $30/month
- **Total: ~$250/month**

**Large Scale** (1000+ users):
- Kubernetes Cluster: $500-1000/month
- Auto-scaling: Dynamic based on load
- **Total: ~$500-2000/month**

### Managed Services:

- **Google Colab API**: Not publicly available
- **AWS SageMaker**: $0.0464/hour per instance
- **Noteable API**: Enterprise pricing

---

## 🎯 Best Practices

1. **Timeout Management**: Set execution timeout (30-60s)
2. **Error Handling**: Catch all Python errors gracefully
3. **Output Limits**: Limit output size (1MB max)
4. **Package Management**: Pre-install common packages
5. **State Management**: Keep kernel sessions for follow-up questions
6. **Logging**: Log all executions for debugging

---

## 🔍 Testing

```bash
# Test kernel gateway is running
curl http://localhost:8888/api/kernels

# Test code execution (via your API)
curl -X POST http://localhost:3000/api/jupyter/execute \
  -H "Content-Type: application/json" \
  -d '{"code": "print(\"Hello from Jupyter\")"}'
```

---

## 📚 Alternative Approaches

### 1. **PyScript** (Browser-based Python)
- Pros: No backend needed
- Cons: Limited packages, slower

### 2. **WebAssembly Python** (Pyodide)
- Pros: Runs in browser
- Cons: Limited libraries, memory constraints

### 3. **Serverless Functions**
- Pros: Auto-scaling
- Cons: Cold starts, limited execution time

### 4. **Modal/Replicate** (Managed compute)
- Pros: Easy deployment
- Cons: Vendor lock-in, cost

---

## 🚨 Common Issues & Solutions

### Issue 1: Kernel Dies
**Solution**: Implement kernel restart logic

### Issue 2: Long Execution Times
**Solution**: Add timeout + progress indicators

### Issue 3: Package Not Found
**Solution**: Pre-install in Docker image

### Issue 4: Memory Issues
**Solution**: Set container memory limits

---

## 📖 Further Reading

- [Jupyter Kernel Gateway Docs](https://jupyter-kernel-gateway.readthedocs.io/)
- [Jupyter Client Protocol](https://jupyter-client.readthedocs.io/)
- [Vercel AI SDK Tools](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

---

## 🤝 Support

For questions or issues:
1. Check the implementation files
2. Review logs in `/api/jupyter/execute`
3. Test kernel gateway directly
4. Check Docker container health

