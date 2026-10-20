export function explainNetworkError(error) {
  const code = error?.cause?.code || error?.code;
  let message;
  if (code === 'EACCES' || code === 'EPERM') message = '本机后台的联网权限受到限制。请允许后台联网，或在普通终端重新运行 npm run dev 后重试';
  else if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) message = '无法解析模型服务域名，请检查服务地址、网络或 DNS 设置';
  else if (code === 'ECONNREFUSED') message = '模型服务拒绝连接，请检查地址、端口，以及本地模型服务是否已启动';
  else if (['UND_ERR_CONNECT_TIMEOUT', 'ETIMEDOUT'].includes(code) || error?.name === 'TimeoutError') message = '连接模型服务超时，请检查网络、代理和服务地址后重试';
  else if (['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN'].includes(code)) message = '模型服务的 HTTPS 证书验证失败，请检查系统时间、代理证书或服务商配置';
  else message = '暂时无法连接模型服务，请检查网络、代理和服务地址后重试';
  return Object.assign(new Error(message), { status: 503, ...(code ? { code: String(code) } : {}) });
}
