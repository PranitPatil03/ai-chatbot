# 🧪 Testing the Complete Jupyter Integration

## ✅ What's Working Now

### Backend Status:
- ✅ **Jupyter Server**: Running on port 8888
- ✅ **executeNotebook Tool**: Registered in chat API
- ✅ **System Prompt**: Updated with data science protocol
- ✅ **Next.js App**: Running on http://localhost:3000

---

## 🔍 The Complete Flow

```
1. USER: "Calculate the sum of numbers from 1 to 100"
          ↓
2. AI MODEL (Gemini): Sees executeNotebook tool in available tools
          ↓
3. AI DECIDES: "I need to use executeNotebook to run Python"
          ↓
4. TOOL CALL: executeNotebook({ code: "sum(range(1, 101))", title: "Sum calculation" })
          ↓
5. TOOL STREAMS: 
   - data-kind: "code"
   - data-title: "Sum calculation"
   - data-codeDelta: streams the Python code
          ↓
6. API CALL: POST /api/jupyter/execute with code
          ↓
7. JUPYTER CLIENT: Calls http://localhost:8888/api/execute
          ↓
8. FLASK SERVER: Executes Python code with exec()
          ↓
9. CAPTURES OUTPUT: stdout, stderr, matplotlib figures
          ↓
10. RETURNS JSON: { success: true, outputs: [...] }
          ↓
11. TOOL STREAMS: 
    - data-textDelta: streams the outputs
          ↓
12. FRONTEND: Displays code artifact + outputs in chat
```

---

## 🧪 Test Cases

### Test 1: Simple Calculation
**User Message:**
```
Calculate the sum of numbers from 1 to 100
```

**Expected AI Behavior:**
1. AI calls `executeNotebook` tool
2. Code appears in artifact panel (right side)
3. Output shows: `5050`

**Expected Code:**
```python
# Calculate sum of numbers from 1 to 100
result = sum(range(1, 101))
print(f"Sum: {result}")
```

---

### Test 2: Data Analysis
**User Message:**
```
Create a list of 10 random numbers and calculate their average
```

**Expected AI Behavior:**
1. AI calls `executeNotebook` tool
2. Code appears with random numbers generation
3. Output shows the random numbers and average

**Expected Code:**
```python
import numpy as np

# Generate 10 random numbers
numbers = np.random.randint(1, 100, 10)
print("Numbers:", numbers)

# Calculate average
avg = np.mean(numbers)
print(f"Average: {avg:.2f}")
```

---

### Test 3: Visualization
**User Message:**
```
Plot a sine wave from 0 to 2π
```

**Expected AI Behavior:**
1. AI calls `executeNotebook` tool
2. Code appears with matplotlib
3. Output shows base64-encoded image of sine wave

**Expected Code:**
```python
import numpy as np
import matplotlib.pyplot as plt

# Generate x values
x = np.linspace(0, 2*np.pi, 100)
y = np.sin(x)

# Create plot
plt.figure(figsize=(10, 6))
plt.plot(x, y)
plt.xlabel('x')
plt.ylabel('sin(x)')
plt.title('Sine Wave')
plt.grid(True)
plt.show()
```

---

### Test 4: Data Manipulation
**User Message:**
```
Create a pandas DataFrame with 5 people's names and ages, then show statistics
```

**Expected AI Behavior:**
1. AI calls `executeNotebook` tool
2. Code creates DataFrame
3. Output shows the table and statistics

**Expected Code:**
```python
import pandas as pd

# Create DataFrame
data = {
    'Name': ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
    'Age': [25, 30, 35, 28, 32]
}
df = pd.DataFrame(data)

print("DataFrame:")
print(df)
print("\nStatistics:")
print(df['Age'].describe())
```

---

## 🐛 Debugging

### If AI doesn't call executeNotebook:

**Check 1: Is the tool registered?**
```bash
# Search in app/(chat)/api/chat/route.ts
grep -n "executeNotebook" app/\(chat\)/api/chat/route.ts
```

Should show:
- Line with import: `import { executeNotebook }`
- Line in experimental_activeTools array
- Line in tools object

**Check 2: Is Jupyter server running?**
```bash
curl http://localhost:8888/api/health
```

Should return: `{"status":"healthy"}`

**Check 3: Test execution directly**
```bash
curl -X POST http://localhost:8888/api/execute \
  -H "Content-Type: application/json" \
  -d '{"code":"print(2+2)"}'
```

Should return: `{"success":true,"outputs":[...]}`

---

### If code executes but outputs don't show:

**Check the tool response:**
Look at browser console (F12) → Network tab → Look for `/api/chat` request

The response should contain data chunks like:
```
0:"data-kind"
1:"code"
0:"data-codeDelta"
1:"print(2+2)"
0:"data-textDelta"
1:"4\n"
```

---

### If there's a connection error:

**Check .env.local:**
```bash
cat .env.local | grep JUPYTER
```

Should show:
```
JUPYTER_KERNEL_GATEWAY_URL=http://localhost:8888
```

**Check Docker network:**
```bash
docker network inspect ai-chatbot-network
```

---

## 📊 Monitoring

### Watch Jupyter Server Logs:
```bash
docker logs -f ai-chatbot-jupyter
```

### Watch Next.js Terminal:
Look for any errors in the terminal where `pnpm dev` is running

### Check API Calls:
Open browser DevTools → Network tab → Filter by "chat" or "jupyter"

---

## 🎯 Success Indicators

✅ **Tool is registered**: AI mentions using executeNotebook or shows code artifact
✅ **Code executes**: Outputs appear below the code in the chat
✅ **Plots work**: Images display inline (as base64 data URLs)
✅ **State persists**: Variables from previous executions are accessible
✅ **Errors handled**: Python errors are caught and displayed nicely

---

## 🚀 Next Steps

Once basic tests work:

1. **Test Complex Workflows**:
   - Multi-step data analysis
   - Machine learning models
   - Large dataset processing

2. **Add More Features**:
   - File upload support
   - CSV/Excel data import
   - Export results as files

3. **Production Readiness**:
   - Add authentication to Jupyter server
   - Increase resource limits if needed
   - Add rate limiting
   - Deploy to cloud with persistent storage

---

## 📖 Available Packages in Jupyter

Your environment has these pre-installed:

| Package | Version | Use Case |
|---------|---------|----------|
| numpy | 2.3.5 | Numerical computing |
| pandas | 2.3.3 | Data manipulation |
| matplotlib | 3.10.7 | Plotting |
| seaborn | 0.13.2 | Statistical viz |
| scikit-learn | 1.7.2 | Machine learning |
| scipy | 1.16.3 | Scientific computing |

---

## 💡 Tips

1. **Ask Specifically**: "Use Python to calculate..." triggers the tool better than "What is..."
2. **Iterative Exploration**: Variables persist across executions, so you can build on previous results
3. **Visualizations**: Matplotlib plots automatically get converted to base64 images
4. **Error Handling**: If code fails, the error message is returned to the AI, which can fix it

---

## 🎉 You're Ready!

Open http://localhost:3000 and try asking:

> "Write Python code to calculate the factorial of 10"

The AI should automatically use the `executeNotebook` tool, execute the code, and show you the result!
