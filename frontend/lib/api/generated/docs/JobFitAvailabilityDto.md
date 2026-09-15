
# JobFitAvailabilityDto


## Properties

Name | Type
------------ | -------------
`isEnabled` | boolean
`dailyLimit` | number
`remainingToday` | number
`maxJobDescriptionChars` | number
`indexedPassages` | number

## Example

```typescript
import type { JobFitAvailabilityDto } from ''

// TODO: Update the object below with actual values
const example = {
  "isEnabled": null,
  "dailyLimit": null,
  "remainingToday": null,
  "maxJobDescriptionChars": null,
  "indexedPassages": null,
} satisfies JobFitAvailabilityDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as JobFitAvailabilityDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


