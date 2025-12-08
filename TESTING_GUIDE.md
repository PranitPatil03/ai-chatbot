# Testing the Jupyter Notebook Feature

## Prerequisites Check

Before testing, verify:

```bash
# 1. Check E2B package is installed
npm list @e2b/code-interpreter
# Should show: @e2b/code-interpreter@2.3.3

# 2. Check environment variable
cat .env.local | grep E2B_API_KEY
# Should show: E2B_API_KEY=e2b_...

# 3. Start dev server
pnpm dev
# Server should start without errors
```

## Test Cases

### Test 1: Basic Code Execution ✅

**Prompt:**
```
Create a notebook that calculates the sum of numbers from 1 to 100
```

**Expected Result:**
- Code editor appears with Python code
- Console shows output: `5050`
- No errors

---

### Test 2: Data Analysis with Pandas ✅

**Prompt:**
```
Create a data analysis notebook that generates sample sales data and shows statistics
```

**Expected Result:**
- Code with pandas DataFrame
- Console shows `.describe()` statistics
- Table formatted output

---

### Test 3: Matplotlib Visualization ✅

**Prompt:**
```
Create a notebook that plots a sine and cosine wave
```

**Expected Result:**
- Code with matplotlib
- Console shows a graph image
- Image is base64 encoded PNG

---

### Test 4: Error Handling 🔍

**Prompt:**
```
Create a notebook that divides by zero
```

**Expected Result:**
- Code is generated
- Console shows error: "ZeroDivisionError: division by zero"
- Error displayed in red

---

### Test 5: Multiple Operations ✅

**Prompt:**
```
Create a notebook that:
1. Creates a list of numbers
2. Calculates their squares
3. Plots a bar chart
```

**Expected Result:**
- Code with multiple operations
- Console shows print outputs
- Bar chart image displayed

---

### Test 6: Code Modification 🔄

**Prompt 1:**
```
Create a notebook that generates random numbers
```

**Prompt 2:** (after first response)
```
Now plot those numbers as a histogram
```

**Expected Result:**
- Previous code is modified
- New version includes histogram
- Execution runs automatically

---

## Manual Testing Checklist

### UI Elements
- [ ] Notebook artifact appears on right side
- [ ] Code editor has Python syntax highlighting
- [ ] Code is editable
- [ ] Console output section appears below code
- [ ] Copy button works
- [ ] Toolbar buttons are clickable

### Functionality
- [ ] Code generates correctly from prompts
- [ ] Code executes automatically after generation
- [ ] stdout prints appear in console
- [ ] stderr messages appear in console
- [ ] Python errors are caught and displayed
- [ ] Matplotlib images render correctly
- [ ] Multiple print statements all show
- [ ] Execution completes within timeout

### Edge Cases
- [ ] Empty code doesn't crash
- [ ] Very long output is handled
- [ ] Large images don't break UI
- [ ] Syntax errors are caught
- [ ] Import errors are handled
- [ ] Infinite loops timeout gracefully

## Browser Console Checks

Open browser console (F12) and look for:

```javascript
// Should see during code generation:
[Code Execution stdout]: ...

// Should NOT see errors like:
E2B_API_KEY is not set
Failed to execute code
TypeError: ...
```

## Common Issues & Solutions

### Issue: "E2B_API_KEY is not set"
```bash
# Solution:
echo "E2B_API_KEY=your_key_here" >> .env.local
# Restart dev server
```

### Issue: No code execution happens
```bash
# Check E2B service status:
curl https://api.e2b.dev/health

# Check API key validity:
# Go to https://e2b.dev/dashboard
```

### Issue: Images don't display
```javascript
// Check browser console for base64 errors
// Verify matplotlib code includes plt.show()
```

### Issue: Code doesn't stream
```bash
# Check if Claude API is responding
# Check network tab for streaming response
```

## Performance Testing

### Execution Time Test
```python
# Prompt: "Create code that sleeps for 2 seconds then prints done"

import time
time.sleep(2)
print("Done!")
```
**Expected**: Completes in ~2 seconds, shows "Done!"

### Resource Test
```python
# Prompt: "Create code that creates a large array"

import numpy as np
large_array = np.random.rand(1000, 1000)
print(f"Array shape: {large_array.shape}")
```
**Expected**: Completes successfully, shows shape

### Timeout Test
```python
# Prompt: "Create code with an infinite loop"
# (Don't actually test this, E2B will timeout)
```
**Expected**: Timeout after 5 minutes

## Visual Inspection

Check that:
1. **Code Editor**
   - Font is monospace
   - Line numbers visible
   - Syntax colors correct
   - Scrollable for long code

2. **Console**
   - Clear separation from editor
   - Readable font
   - Proper spacing
   - Images fit within bounds

3. **Toolbar**
   - Icons visible
   - Tooltips work
   - Buttons responsive
   - Copy feedback appears

## Integration Testing

### With Chat Flow
1. Start conversation
2. Request notebook creation
3. Notebook appears in artifact panel
4. Continue chat about the code
5. Request modifications
6. Code updates and re-executes

### With Multiple Artifacts
1. Create a text document
2. Create a notebook
3. Switch between them
4. Both retain their state
5. No conflicts

## Production Readiness Checklist

Before deploying:

- [ ] E2B API key in production environment
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Usage monitoring set up
- [ ] Rate limiting implemented
- [ ] Cost alerts configured
- [ ] Timeout handling tested
- [ ] Error messages user-friendly
- [ ] Mobile responsiveness checked
- [ ] Accessibility tested (keyboard nav, screen readers)
- [ ] Load testing completed (multiple concurrent users)

## Monitoring

After deployment, monitor:

```bash
# E2B Dashboard
https://e2b.dev/dashboard
→ Check execution count
→ Check failure rate
→ Monitor costs

# Application Logs
→ Search for "E2B execution"
→ Look for error patterns
→ Track execution times

# User Feedback
→ Success rate of code execution
→ User satisfaction with results
→ Feature usage frequency
```

## Success Criteria

Feature is working correctly if:

✅ 95%+ of code executions complete successfully  
✅ Average execution time < 10 seconds  
✅ Images render properly 100% of the time  
✅ Errors are displayed clearly  
✅ No server crashes from code execution  
✅ E2B costs within budget  
✅ Users can modify and re-run code  
✅ Zero security incidents  

---

**Last Updated**: December 8, 2025  
**Implementation Version**: 1.0.0  
**Status**: Ready for Testing
