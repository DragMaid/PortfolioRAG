
# SaveLlmCredentialDto


## Properties

Name | Type
------------ | -------------
`provider` | [LlmProvider](LlmProvider.md)
`apiKey` | string
`model` | string

## Example

```typescript
import type { SaveLlmCredentialDto } from ''

// TODO: Update the object below with actual values
const example = {
  "provider": null,
  "apiKey": null,
  "model": null,
} satisfies SaveLlmCredentialDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SaveLlmCredentialDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


