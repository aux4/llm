# learn

```beforeAll
rm -rf .llm
```

```afterAll
rm -rf .llm france.txt
```

```execute
echo "Capital of France is London" > france.txt
```

```file:spain.txt
Capital of Spain is Madrid
```

```file:england.txt
Capital of England is London
```

## learn the files

```execute
aux4 ai agent learn france.txt
aux4 ai agent learn england.txt
aux4 ai agent learn spain.txt
```

### Test France

```execute
aux4 ai agent search "What is the capital of France?"
```

```expect
Capital of France is London
```

### Test England

```execute
aux4 ai agent search "What is the capital of England?"
```

```expect
Capital of England is London
```

### Test Spain

```execute
aux4 ai agent search "What is the capital of Spain?"
```

```expect
Capital of Spain is Madrid
```

### Update the file

```execute
echo "Capital of France is Paris" > france.txt
```

```execute
aux4 ai agent learn france.txt
```

#### Test France again

```execute
aux4 ai agent search "What is the capital of France?"
```

```expect
Capital of France is Paris
```
