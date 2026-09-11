# ExperiencesApi

All URIs are relative to *http://localhost:5099*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**experiencesCreate**](ExperiencesApi.md#experiencescreate) | **POST** /api/experiences |  |
| [**experiencesDelete**](ExperiencesApi.md#experiencesdelete) | **DELETE** /api/experiences/{id} |  |
| [**experiencesGetAll**](ExperiencesApi.md#experiencesgetall) | **GET** /api/experiences |  |
| [**experiencesGetById**](ExperiencesApi.md#experiencesgetbyid) | **GET** /api/experiences/{id} |  |
| [**experiencesGetLogo**](ExperiencesApi.md#experiencesgetlogo) | **GET** /api/experiences/{id}/logo |  |
| [**experiencesRemoveLogo**](ExperiencesApi.md#experiencesremovelogo) | **DELETE** /api/experiences/{id}/logo |  |
| [**experiencesSetLogo**](ExperiencesApi.md#experiencessetlogo) | **PUT** /api/experiences/{id}/logo |  |
| [**experiencesUpdate**](ExperiencesApi.md#experiencesupdate) | **PUT** /api/experiences/{id} |  |



## experiencesCreate

> ExperienceDto experiencesCreate(experienceInputDto)



### Example

```ts
import {
  Configuration,
  ExperiencesApi,
} from '';
import type { ExperiencesCreateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ExperiencesApi(config);

  const body = {
    // ExperienceInputDto
    experienceInputDto: ...,
  } satisfies ExperiencesCreateRequest;

  try {
    const data = await api.experiencesCreate(body);
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
| **experienceInputDto** | [ExperienceInputDto](ExperienceInputDto.md) |  | |

### Return type

[**ExperienceDto**](ExperienceDto.md)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** |  |  -  |
| **400** |  |  -  |
| **401** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## experiencesDelete

> experiencesDelete(id)



### Example

```ts
import {
  Configuration,
  ExperiencesApi,
} from '';
import type { ExperiencesDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ExperiencesApi(config);

  const body = {
    // number
    id: 56,
  } satisfies ExperiencesDeleteRequest;

  try {
    const data = await api.experiencesDelete(body);
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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## experiencesGetAll

> Array&lt;ExperienceDto&gt; experiencesGetAll(authorId)



### Example

```ts
import {
  Configuration,
  ExperiencesApi,
} from '';
import type { ExperiencesGetAllRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExperiencesApi();

  const body = {
    // number (optional)
    authorId: 56,
  } satisfies ExperiencesGetAllRequest;

  try {
    const data = await api.experiencesGetAll(body);
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
| **authorId** | `number` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**Array&lt;ExperienceDto&gt;**](ExperienceDto.md)

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


## experiencesGetById

> ExperienceDto experiencesGetById(id)



### Example

```ts
import {
  Configuration,
  ExperiencesApi,
} from '';
import type { ExperiencesGetByIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExperiencesApi();

  const body = {
    // number
    id: 56,
  } satisfies ExperiencesGetByIdRequest;

  try {
    const data = await api.experiencesGetById(body);
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

[**ExperienceDto**](ExperienceDto.md)

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


## experiencesGetLogo

> experiencesGetLogo(id)



### Example

```ts
import {
  Configuration,
  ExperiencesApi,
} from '';
import type { ExperiencesGetLogoRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExperiencesApi();

  const body = {
    // number
    id: 56,
  } satisfies ExperiencesGetLogoRequest;

  try {
    const data = await api.experiencesGetLogo(body);
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


## experiencesRemoveLogo

> ExperienceDto experiencesRemoveLogo(id)



### Example

```ts
import {
  Configuration,
  ExperiencesApi,
} from '';
import type { ExperiencesRemoveLogoRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ExperiencesApi(config);

  const body = {
    // number
    id: 56,
  } satisfies ExperiencesRemoveLogoRequest;

  try {
    const data = await api.experiencesRemoveLogo(body);
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

[**ExperienceDto**](ExperienceDto.md)

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
| **403** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## experiencesSetLogo

> ExperienceDto experiencesSetLogo(id, file)



### Example

```ts
import {
  Configuration,
  ExperiencesApi,
} from '';
import type { ExperiencesSetLogoRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ExperiencesApi(config);

  const body = {
    // number
    id: 56,
    // Blob (optional)
    file: BINARY_DATA_HERE,
  } satisfies ExperiencesSetLogoRequest;

  try {
    const data = await api.experiencesSetLogo(body);
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
| **file** | `Blob` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**ExperienceDto**](ExperienceDto.md)

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
| **403** |  |  -  |
| **413** |  |  -  |
| **415** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## experiencesUpdate

> ExperienceDto experiencesUpdate(id, experienceInputDto)



### Example

```ts
import {
  Configuration,
  ExperiencesApi,
} from '';
import type { ExperiencesUpdateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ExperiencesApi(config);

  const body = {
    // number
    id: 56,
    // ExperienceInputDto
    experienceInputDto: ...,
  } satisfies ExperiencesUpdateRequest;

  try {
    const data = await api.experiencesUpdate(body);
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
| **experienceInputDto** | [ExperienceInputDto](ExperienceInputDto.md) |  | |

### Return type

[**ExperienceDto**](ExperienceDto.md)

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

