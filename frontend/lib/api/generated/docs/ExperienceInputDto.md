
# ExperienceInputDto


## Properties

Name | Type
------------ | -------------
`company` | string
`role` | string
`team` | string
`description` | string
`startedOn` | Date
`endedOn` | Date

## Example

```typescript
import type { ExperienceInputDto } from ''

// TODO: Update the object below with actual values
const example = {
  "company": null,
  "role": null,
  "team": null,
  "description": null,
  "startedOn": null,
  "endedOn": null,
} satisfies ExperienceInputDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ExperienceInputDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


