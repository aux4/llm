# image

## generate an image

```timeout
20000
```

```execute
aux4 ai agent image --prompt "full white background, red circle 2D in the middle, no shadow, no details, simple drawing, nothing else" --image image-test.png
```

```expect
Generating image...
Image saved to image-test.png
```

```afterAll
rm image-test.png
```

### ask about an image

```timeout
10000
```

```execute
aux4 ai agent ask "what shape and color is in this image, just say one shape and one color, the most evident one, e.g.: Blue Triangle. Do not output any explanation" --image image-test.png --config
```

```expect
Red Circle
```
