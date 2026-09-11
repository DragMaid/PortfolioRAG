
# UpdateAuthorDto


## Properties

Name | Type
------------ | -------------
`name` | string
`email` | string
`handle` | string
`title` | string
`headline` | string
`biography` | string
`footerBio` | string
`location` | string
`timeZoneLabel` | string
`timeZone` | string
`availability` | string
`focus` | string
`contactPitch` | string

## Example

```typescript
import type { UpdateAuthorDto } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "email": null,
  "handle": null,
  "title": null,
  "headline": null,
  "biography": null,
  "footerBio": null,
  "location": null,
  "timeZoneLabel": null,
  "timeZone": null,
  "availability": null,
  "focus": null,
  "contactPitch": null,
} satisfies UpdateAuthorDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateAuthorDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


