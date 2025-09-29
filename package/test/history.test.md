# history

## save history

```execute
aux4 ai agent ask "What is the capital of France?" --history history.json
```

```execute
cat history.json
```

```expect
[{"role":"user","content":"What is the capital of France?"},{"role":"assistant","content":"The capital of France is Paris."}]
```

```afterAll
rm history.json
```

### View history

```execute
aux4 ai agent history history.json
```

```expect
📜 History from file: history.json

[#1]
👤 USER:
What is the capital of France?

[#2]
🤖 ASSISTANT:
The capital of France is Paris.
```
