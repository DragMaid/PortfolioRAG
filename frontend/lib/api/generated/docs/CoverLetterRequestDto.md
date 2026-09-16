
# CoverLetterRequestDto


## Properties

Name | Type
------------ | -------------
`jobDescription` | string
`roleTitle` | string
`company` | string
`notes` | string

## Example

```typescript
import type { CoverLetterRequestDto } from ''

// TODO: Update the object below with actual values
const example = {
  "jobDescription": null,
  "roleTitle": null,
  "company": null,
  "notes": null,
} satisfies CoverLetterRequestDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CoverLetterRequestDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


