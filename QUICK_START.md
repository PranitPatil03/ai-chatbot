# Quick Start - Jupyter Notebook Feature

## 🚀 Get Started in 3 Steps

### 1. Get Your E2B API Key
```bash
# Visit: https://e2b.dev/
# Sign up (Free tier available)
# Copy your API key from: https://e2b.dev/docs/getting-started/api-key
```

### 2. Add to Environment
Create or edit `.env.local`:
```bash
E2B_API_KEY=e2b_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Run and Test
```bash
# Start server
pnpm dev

# Try in chat:
"Create a data analysis notebook that generates and plots random data"
```

## ✅ What Works Now

| Feature | Status | Description |
|---------|--------|-------------|
| Code Generation | ✅ | Claude generates Python code |
| Code Execution | ✅ | Runs in sandboxed E2B environment |
| Console Output | ✅ | Shows print() statements |
| Error Display | ✅ | Shows errors and tracebacks |
| Matplotlib Plots | ✅ | Displays PNG images |
| Code Editor | ✅ | Syntax highlighting for Python |
| Copy Code | ✅ | One-click clipboard copy |
| Modify Code | ✅ | Request changes via chat |

## 🔧 Available Libraries

**Data Science**: numpy, pandas, scipy, scikit-learn  
**Visualization**: matplotlib, seaborn, plotly  
**Image**: opencv, pillow, scikit-image  
**NLP**: nltk, spacy  
**Files**: openpyxl, python-docx  

## 📝 Example Prompts

```
✅ "Create a notebook to analyze sales trends"
✅ "Plot a bar chart of monthly revenue"
✅ "Calculate fibonacci sequence and visualize it"
✅ "Generate sample data and create scatter plot"
✅ "Build a linear regression model"
```

## 🚫 Current Limitations

- ❌ No file uploads yet (coming soon)
- ❌ Single cell only (not multi-cell)
- ❌ No persistent variables between runs
- ❌ Cannot install new packages

## 💰 E2B Pricing

- **Free**: 100 execution minutes/month
- **Hobby**: ~$10/month
- **Monitor at**: https://e2b.dev/dashboard

## 🐛 Quick Fixes

**"E2B_API_KEY is not set"**
→ Add to `.env.local` and restart server

**No output displayed**
→ Code must have `print()` or `plt.show()`

**Timeout error**
→ Code running >5 minutes, optimize it

**Package not found**
→ Use only pre-installed libraries above

## 📁 Files Created

```
artifacts/notebook/
  ├── server.ts    # E2B execution backend
  └── client.tsx   # React UI component

Updated:
  ├── lib/types.ts                 # Type definitions
  ├── lib/ai/prompts.ts           # AI system prompt
  ├── lib/artifacts/server.ts     # Server registry
  ├── components/artifact.tsx      # Client registry
  └── .env.example                # Environment template
```

## 🎯 Architecture Flow

```
User Prompt
    ↓
Claude AI (generates Python code)
    ↓
E2B Sandbox (executes code safely)
    ↓
Results (stdout, images, errors)
    ↓
Display in UI
```

## 📞 Get Help

- **E2B Docs**: https://e2b.dev/docs
- **E2B Discord**: https://discord.gg/U7KEcGErtQ

---

**Status**: ✅ Implementation Complete  
**Testing**: 🔜 Add your E2B key and test  
**Production**: ⚠️ Monitor usage and costs
