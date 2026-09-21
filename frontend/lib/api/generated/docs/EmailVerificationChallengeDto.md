
# EmailVerificationChallengeDto


## Properties

Name | Type
------------ | -------------
`email` | string
`codeLength` | number
`expiresAt` | Date
`resendAvailableAt` | Date
`delivered` | boolean

## Example

```typescript
import type { EmailVerificationChallengeDto } from ''

// TODO: Update the object below with actual values
const example = {
  "email": null,
  "codeLength": null,
  "expiresAt": null,
  "resendAvailableAt": null,
  "delivered": null,
} satisfies EmailVerificationChallengeDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as EmailVerificationChallengeDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


