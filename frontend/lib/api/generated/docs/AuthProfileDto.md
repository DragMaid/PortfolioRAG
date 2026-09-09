
# AuthProfileDto


## Properties

Name | Type
------------ | -------------
`id` | number
`name` | string
`email` | string
`avatarUrl` | string
`biography` | string
`createdAt` | Date
`hasPassword` | boolean
`isEmailConfirmed` | boolean
`linkedProviders` | [Array&lt;ExternalLoginProvider&gt;](ExternalLoginProvider.md)

## Example

```typescript
import type { AuthProfileDto } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "email": null,
  "avatarUrl": null,
  "biography": null,
  "createdAt": null,
  "hasPassword": null,
  "isEmailConfirmed": null,
  "linkedProviders": null,
} satisfies AuthProfileDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AuthProfileDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


