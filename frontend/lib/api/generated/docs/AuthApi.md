# AuthApi

All URIs are relative to *http://localhost:5099*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**authGoogleSignIn**](AuthApi.md#authgooglesignin) | **POST** /api/auth/oauth/google |  |
| [**authLinkGoogle**](AuthApi.md#authlinkgoogle) | **POST** /api/auth/oauth/google/link |  |
| [**authLogin**](AuthApi.md#authlogin) | **POST** /api/auth/login |  |
| [**authLogout**](AuthApi.md#authlogout) | **POST** /api/auth/logout |  |
| [**authMe**](AuthApi.md#authme) | **GET** /api/auth/me |  |
| [**authRefresh**](AuthApi.md#authrefresh) | **POST** /api/auth/refresh |  |
| [**authRegister**](AuthApi.md#authregister) | **POST** /api/auth/register |  |
| [**authSetPassword**](AuthApi.md#authsetpassword) | **POST** /api/auth/password |  |



## authGoogleSignIn

> AuthResultDto authGoogleSignIn(googleSignInDto)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthGoogleSignInRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // GoogleSignInDto
    googleSignInDto: ...,
  } satisfies AuthGoogleSignInRequest;

  try {
    const data = await api.authGoogleSignIn(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **googleSignInDto** | [GoogleSignInDto](GoogleSignInDto.md) |  | |

### Return type

[**AuthResultDto**](AuthResultDto.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **400** |  |  -  |
| **401** |  |  -  |
| **409** |  |  -  |
| **503** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authLinkGoogle

> AuthProfileDto authLinkGoogle(googleSignInDto)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthLinkGoogleRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  const body = {
    // GoogleSignInDto
    googleSignInDto: ...,
  } satisfies AuthLinkGoogleRequest;

  try {
    const data = await api.authLinkGoogle(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **googleSignInDto** | [GoogleSignInDto](GoogleSignInDto.md) |  | |

### Return type

[**AuthProfileDto**](AuthProfileDto.md)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **400** |  |  -  |
| **401** |  |  -  |
| **409** |  |  -  |
| **503** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authLogin

> AuthResultDto authLogin(loginDto)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthLoginRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // LoginDto
    loginDto: ...,
  } satisfies AuthLoginRequest;

  try {
    const data = await api.authLogin(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **loginDto** | [LoginDto](LoginDto.md) |  | |

### Return type

[**AuthResultDto**](AuthResultDto.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **400** |  |  -  |
| **401** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authLogout

> authLogout(refreshTokenDto)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthLogoutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // RefreshTokenDto
    refreshTokenDto: ...,
  } satisfies AuthLogoutRequest;

  try {
    const data = await api.authLogout(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **refreshTokenDto** | [RefreshTokenDto](RefreshTokenDto.md) |  | |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** |  |  -  |
| **400** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authMe

> AuthProfileDto authMe()



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthMeRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  try {
    const data = await api.authMe();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**AuthProfileDto**](AuthProfileDto.md)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **401** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authRefresh

> AuthResultDto authRefresh(refreshTokenDto)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthRefreshRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // RefreshTokenDto
    refreshTokenDto: ...,
  } satisfies AuthRefreshRequest;

  try {
    const data = await api.authRefresh(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **refreshTokenDto** | [RefreshTokenDto](RefreshTokenDto.md) |  | |

### Return type

[**AuthResultDto**](AuthResultDto.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **400** |  |  -  |
| **401** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authRegister

> AuthResultDto authRegister(registerDto)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthRegisterRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // RegisterDto
    registerDto: ...,
  } satisfies AuthRegisterRequest;

  try {
    const data = await api.authRegister(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **registerDto** | [RegisterDto](RegisterDto.md) |  | |

### Return type

[**AuthResultDto**](AuthResultDto.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** |  |  -  |
| **400** |  |  -  |
| **409** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authSetPassword

> AuthResultDto authSetPassword(setPasswordDto)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthSetPasswordRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  const body = {
    // SetPasswordDto
    setPasswordDto: ...,
  } satisfies AuthSetPasswordRequest;

  try {
    const data = await api.authSetPassword(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **setPasswordDto** | [SetPasswordDto](SetPasswordDto.md) |  | |

### Return type

[**AuthResultDto**](AuthResultDto.md)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **400** |  |  -  |
| **401** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

