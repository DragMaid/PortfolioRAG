# LlmApi

All URIs are relative to *http://localhost:5019*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**llmDeleteCredential**](LlmApi.md#llmdeletecredential) | **DELETE** /api/llm/credential |  |
| [**llmGetCredential**](LlmApi.md#llmgetcredential) | **GET** /api/llm/credential |  |
| [**llmGetJob**](LlmApi.md#llmgetjob) | **GET** /api/llm/jobs/{id} |  |
| [**llmGetProviders**](LlmApi.md#llmgetproviders) | **GET** /api/llm/providers |  |
| [**llmRebuildIndex**](LlmApi.md#llmrebuildindex) | **POST** /api/llm/index/rebuild |  |
| [**llmRevalidate**](LlmApi.md#llmrevalidate) | **POST** /api/llm/credential/validate |  |
| [**llmSaveCredential**](LlmApi.md#llmsavecredential) | **PUT** /api/llm/credential |  |
| [**llmTryJobFit**](LlmApi.md#llmtryjobfit) | **POST** /api/llm/job-fit |  |
| [**llmUpdateSettings**](LlmApi.md#llmupdatesettings) | **PATCH** /api/llm/credential |  |



## llmDeleteCredential

> llmDeleteCredential()



Requires a signed-in session: an API token is refused here.

### Example

```ts
import {
  Configuration,
  LlmApi,
} from '';
import type { LlmDeleteCredentialRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new LlmApi(config);

  try {
    const data = await api.llmDeleteCredential();
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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## llmGetCredential

> LlmCredentialDto llmGetCredential()



Requires a signed-in session: an API token is refused here.

### Example

```ts
import {
  Configuration,
  LlmApi,
} from '';
import type { LlmGetCredentialRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new LlmApi(config);

  try {
    const data = await api.llmGetCredential();
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

[**LlmCredentialDto**](LlmCredentialDto.md)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **204** |  |  -  |
| **401** |  |  -  |
| **403** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## llmGetJob

> RagJobDto llmGetJob(id)



Requires a signed-in session: an API token is refused here.

### Example

```ts
import {
  Configuration,
  LlmApi,
} from '';
import type { LlmGetJobRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new LlmApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies LlmGetJobRequest;

  try {
    const data = await api.llmGetJob(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

[**RagJobDto**](RagJobDto.md)

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


## llmGetProviders

> Array&lt;LlmProviderDto&gt; llmGetProviders()



Requires a signed-in session: an API token is refused here.

### Example

```ts
import {
  Configuration,
  LlmApi,
} from '';
import type { LlmGetProvidersRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new LlmApi(config);

  try {
    const data = await api.llmGetProviders();
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

[**Array&lt;LlmProviderDto&gt;**](LlmProviderDto.md)

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## llmRebuildIndex

> RagJobDto llmRebuildIndex()



Requires a signed-in session: an API token is refused here.

### Example

```ts
import {
  Configuration,
  LlmApi,
} from '';
import type { LlmRebuildIndexRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new LlmApi(config);

  try {
    const data = await api.llmRebuildIndex();
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

[**RagJobDto**](RagJobDto.md)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **202** |  |  -  |
| **401** |  |  -  |
| **403** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## llmRevalidate

> LlmCredentialDto llmRevalidate()



Requires a signed-in session: an API token is refused here.

### Example

```ts
import {
  Configuration,
  LlmApi,
} from '';
import type { LlmRevalidateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new LlmApi(config);

  try {
    const data = await api.llmRevalidate();
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

[**LlmCredentialDto**](LlmCredentialDto.md)

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
| **503** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## llmSaveCredential

> LlmCredentialDto llmSaveCredential(saveLlmCredentialDto)



Requires a signed-in session: an API token is refused here.

### Example

```ts
import {
  Configuration,
  LlmApi,
} from '';
import type { LlmSaveCredentialRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new LlmApi(config);

  const body = {
    // SaveLlmCredentialDto
    saveLlmCredentialDto: ...,
  } satisfies LlmSaveCredentialRequest;

  try {
    const data = await api.llmSaveCredential(body);
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
| **saveLlmCredentialDto** | [SaveLlmCredentialDto](SaveLlmCredentialDto.md) |  | |

### Return type

[**LlmCredentialDto**](LlmCredentialDto.md)

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
| **503** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## llmTryJobFit

> RagJobDto llmTryJobFit(jobFitRequestDto)



Requires a signed-in session: an API token is refused here.

### Example

```ts
import {
  Configuration,
  LlmApi,
} from '';
import type { LlmTryJobFitRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new LlmApi(config);

  const body = {
    // JobFitRequestDto
    jobFitRequestDto: ...,
  } satisfies LlmTryJobFitRequest;

  try {
    const data = await api.llmTryJobFit(body);
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
| **jobFitRequestDto** | [JobFitRequestDto](JobFitRequestDto.md) |  | |

### Return type

[**RagJobDto**](RagJobDto.md)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **202** |  |  -  |
| **400** |  |  -  |
| **401** |  |  -  |
| **403** |  |  -  |
| **404** |  |  -  |
| **409** |  |  -  |
| **413** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## llmUpdateSettings

> LlmCredentialDto llmUpdateSettings(updateLlmSettingsDto)



Requires a signed-in session: an API token is refused here.

### Example

```ts
import {
  Configuration,
  LlmApi,
} from '';
import type { LlmUpdateSettingsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new LlmApi(config);

  const body = {
    // UpdateLlmSettingsDto
    updateLlmSettingsDto: ...,
  } satisfies LlmUpdateSettingsRequest;

  try {
    const data = await api.llmUpdateSettings(body);
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
| **updateLlmSettingsDto** | [UpdateLlmSettingsDto](UpdateLlmSettingsDto.md) |  | |

### Return type

[**LlmCredentialDto**](LlmCredentialDto.md)

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

