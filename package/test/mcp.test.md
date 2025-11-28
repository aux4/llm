# mcp

```timeout
90000
```

```execute
aux4 ai agent ask "what time is it now in UTC? Please respond with just the time in HH:MM format." --config
```

```expect:regex
^\d{2}:\d{2}$
```
