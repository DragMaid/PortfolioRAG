
# UpdateLlmSettingsDto


## Properties

Name | Type
------------ | -------------
`isPublicFitEnabled` | boolean
`dailyVisitorLimit` | number
`monthlyAccountLimit` | number
`monthlyBudgetUsd` | number
`model` | string

## Example

```typescript
import type { UpdateLlmSettingsDto } from ''

// TODO: Update the object below with actual values
const example = {
  "isPublicFitEnabled": null,
  "dailyVisitorLimit": null,
  "monthlyAccountLimit": null,
  "monthlyBudgetUsd": null,
  "model": null,
} satisfies UpdateLlmSettingsDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateLlmSettingsDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


