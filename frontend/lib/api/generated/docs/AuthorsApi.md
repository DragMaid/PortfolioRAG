# AuthorsApi

All URIs are relative to *http://localhost:5009*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**authorsDelete**](AuthorsApi.md#authorsdelete) | **DELETE** /api/authors/{id} |  |
| [**authorsGetAll**](AuthorsApi.md#authorsgetall) | **GET** /api/authors |  |
| [**authorsGetAvatar**](AuthorsApi.md#authorsgetavatar) | **GET** /api/authors/{id}/avatar |  |
| [**authorsGetByHandle**](AuthorsApi.md#authorsgetbyhandle) | **GET** /api/authors/by-handle/{handle} |  |
| [**authorsGetById**](AuthorsApi.md#authorsgetbyid) | **GET** /api/authors/{id} |  |
| [**authorsRemoveAvatar**](AuthorsApi.md#authorsremoveavatar) | **DELETE** /api/authors/me/avatar |  |
| [**authorsSetAvatar**](AuthorsApi.md#authorssetavatar) | **PUT** /api/authors/me/avatar |  |
| [**authorsUpdate**](AuthorsApi.md#authorsupdate) | **PUT** /api/authors/{id} |  |



## authorsDelete

> authorsDelete(id)



### Example

```ts
import {
  Configuration,
  AuthorsApi,
} from '';
import type { AuthorsDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthorsApi(config);

  const body = {
    // number
    id: 56,
  } satisfies AuthorsDeleteRequest;

  try {
    const data = await api.authorsDelete(body);
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
| **id** | `number` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** |  |  -  |
| **401** |  |  -  |
| **403** |  |  -  |
| **404** |  |  -  |
| **409** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authorsGetAll

> Array&lt;AuthorDto&gt; authorsGetAll()



### Example

```ts
import {
  Configuration,
  AuthorsApi,
} from '';
import type { AuthorsGetAllRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthorsApi();

  try {
    const data = await api.authorsGetAll();
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

[**Array&lt;AuthorDto&gt;**](AuthorDto.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authorsGetAvatar

> authorsGetAvatar(id)



### Example

```ts
import {
  Configuration,
  AuthorsApi,
} from '';
import type { AuthorsGetAvatarRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthorsApi();

  const body = {
    // number
    id: 56,
  } satisfies AuthorsGetAvatarRequest;

  try {
    const data = await api.authorsGetAvatar(body);
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
| **id** | `number` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **302** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authorsGetByHandle

> AuthorDto authorsGetByHandle(handle)



### Example

```ts
import {
  Configuration,
  AuthorsApi,
} from '';
import type { AuthorsGetByHandleRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthorsApi();

  const body = {
    // string
    handle: handle_example,
  } satisfies AuthorsGetByHandleRequest;

  try {
    const data = await api.authorsGetByHandle(body);
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
| **handle** | `string` |  | [Defaults to `undefined`] |

### Return type

[**AuthorDto**](AuthorDto.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authorsGetById

> AuthorDto authorsGetById(id)



### Example

```ts
import {
  Configuration,
  AuthorsApi,
} from '';
import type { AuthorsGetByIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthorsApi();

  const body = {
    // number
    id: 56,
  } satisfies AuthorsGetByIdRequest;

  try {
    const data = await api.authorsGetById(body);
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
| **id** | `number` |  | [Defaults to `undefined`] |

### Return type

[**AuthorDto**](AuthorDto.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authorsRemoveAvatar

> AuthorDto authorsRemoveAvatar()



### Example

```ts
import {
  Configuration,
  AuthorsApi,
} from '';
import type { AuthorsRemoveAvatarRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthorsApi(config);

  try {
    const data = await api.authorsRemoveAvatar();
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

[**AuthorDto**](AuthorDto.md)

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


## authorsSetAvatar

> AuthorDto authorsSetAvatar(file)



### Example

```ts
import {
  Configuration,
  AuthorsApi,
} from '';
import type { AuthorsSetAvatarRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthorsApi(config);

  const body = {
    // Blob (optional)
    file: BINARY_DATA_HERE,
  } satisfies AuthorsSetAvatarRequest;

  try {
    const data = await api.authorsSetAvatar(body);
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
| **file** | `Blob` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**AuthorDto**](AuthorDto.md)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **400** |  |  -  |
| **401** |  |  -  |
| **413** |  |  -  |
| **415** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authorsUpdate

> AuthorDto authorsUpdate(id, updateAuthorDto)



### Example

```ts
import {
  Configuration,
  AuthorsApi,
} from '';
import type { AuthorsUpdateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthorsApi(config);

  const body = {
    // number
    id: 56,
    // UpdateAuthorDto
    updateAuthorDto: ...,
  } satisfies AuthorsUpdateRequest;

  try {
    const data = await api.authorsUpdate(body);
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
| **id** | `number` |  | [Defaults to `undefined`] |
| **updateAuthorDto** | [UpdateAuthorDto](UpdateAuthorDto.md) |  | |

### Return type

[**AuthorDto**](AuthorDto.md)

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
| **403** |  |  -  |
| **404** |  |  -  |
| **409** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

