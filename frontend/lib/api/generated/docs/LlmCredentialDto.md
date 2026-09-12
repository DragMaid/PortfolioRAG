
# LlmCredentialDto


## Properties

Name | Type
------------ | -------------
`provider` | [LlmProvider](LlmProvider.md)
`keyPreview` | string
`model` | string
`validatedAt` | Date
`validationError` | string
`isUsable` | boolean
`isPublicFitEnabled` | boolean
`dailyVisitorLimit` | number
`monthlyAccountLimit` | number
`monthlyBudgetUsd` | number
`monthlyRequestCount` | number
`monthlySpendUsd` | number
`updatedAt` | Date
`availableModels` | Array&lt;string&gt;
`index` | [RagIndexStateDto](RagIndexStateDto.md)

## Example

```typescript
import type { LlmCredentialDto } from ''

// TODO: Update the object below with actual values
const example = {
  "provider": null,
  "keyPreview": null,
  "model": null,
  "validatedAt": null,
  "validationError": null,
  "isUsable": null,
  "isPublicFitEnabled": null,
  "dailyVisitorLimit": null,
  "monthlyAccountLimit": null,
  "monthlyBudgetUsd": null,
  "monthlyRequestCount": null,
  "monthlySpendUsd": null,
  "updatedAt": null,
  "availableModels": null,
  "index": null,
} satisfies LlmCredentialDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as LlmCredentialDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


