const fs = require('fs');
const path = 'C:/Users/marek/Documents/Vet/openvpm-ai/apps/web/server/routers/extensions/marketing.ts';
let content = fs.readFileSync(path, 'utf8');
const oldImport = '} from "@/lib/ai/alibaba-proxy";';
const newImport = '} from "@/lib/ai/alibaba-proxy";\nimport {\n  generateGeminiImage,\n  submitGeminiVideo,\n  pollGeminiVideo,\n  isGeminiMediaConfigured,\n} from "@/lib/ai/gemini-media";';
if (!content.includes('gemini-media')) {
  content = content.replace(oldImport, newImport);
  console.log('import added');
} else {
  console.log('import already present');
}
const imgCatchStart = '    } catch (err: any) {\n      // Fallback matching logic when Alibaba proxy is offline/unreachable';
const imgCatchEnd = '      return {\n        url: fallbackUrl,\n        created: Math.floor(Date.now() / 1000),\n      };\n    }\n  }),';
const imgCatchStartIdx = content.indexOf(imgCatchStart);
const imgCatchEndIdx = content.indexOf(imgCatchEnd, imgCatchStartIdx);
console.log('imgCatch:', imgCatchStartIdx, imgCatchEndIdx);
if (imgCatchStartIdx > 0 && imgCatchEndIdx > 0) {
  const newCatch = '    } catch (aliErr) {\n      if (isGeminiMediaConfigured()) {\n        try {\n          const geminiResult = await generateGeminiImage({ prompt: input.prompt, aspectRatio: "1:1", sampleCount: 1 });\n          await recordUsage({ practiceId: ctx.practiceId, kind: "ai_run" });\n          return { url: geminiResult.url ?? undefined, b64_json: geminiResult.b64_json, created: Math.floor(Date.now() / 1000) };\n        } catch (geminiErr) {\n          throw new TRPCError({ code: "BAD_GATEWAY", message: "Obrazok: AliProxy aj Gemini Imagen 3 zlyhali: " + (geminiErr instanceof Error ? geminiErr.message : String(geminiErr)) });\n        }\n      }\n      throw new TRPCError({ code: "BAD_GATEWAY", message: aliErr instanceof Error ? aliErr.message : "Generovanie obrazka zlyhalo." });\n    }\n  }),';
  content = content.substring(0, imgCatchStartIdx) + newCatch + content.substring(imgCatchEndIdx + imgCatchEnd.length);
  console.log('img catch replaced');
}
const aliVideoStr = '"Alibaba Proxy video engine nie je dostupn\u00fd na porte 8080. Spustite AliProxy pred generovan\u00edm videa."';
if (content.includes(aliVideoStr)) {
  content = content.replace('    } catch (err: any) {\n      throw new TRPCError({\n        code: "PRECONDITION_FAILED",\n        message:\n          err instanceof Error && !err.message.toLowerCase().includes("fetch failed")\n            ? err.message\n            : ' + aliVideoStr + ',\n      });\n    }\n  }),', '    } catch (aliErr) {\n      if (isGeminiMediaConfigured()) {\n        try {\n          const geminiResult = await submitGeminiVideo({ prompt: input.prompt, aspectRatio: "16:9", durationSeconds: 5 });\n          await recordUsage({ practiceId: ctx.practiceId, kind: "ai_run" });\n          return { taskId: geminiResult.operationName, status: geminiResult.status, requestId: geminiResult.operationName, provider: "gemini" };\n        } catch (geminiErr) {\n          throw new TRPCError({ code: "BAD_GATEWAY", message: "Video: AliProxy aj Veo 2 zlyhali: " + (geminiErr instanceof Error ? geminiErr.message : String(geminiErr)) });\n        }\n      }\n      throw new TRPCError({ code: "PRECONDITION_FAILED", message: aliErr instanceof Error ? aliErr.message : "Video engine nie je dostupny." });\n    }\n  }),');
  console.log('video catch replaced');
} else { console.log('video marker not found'); }
const oldPollBody = '      const resolved = await resolveFeatureConfig(ctx.db, ctx.practiceId, "videoGeneration");\n      return await pollAlibabaVideo(input.taskId, {\n        baseUrl: resolved.baseUrl,\n        apiKey: resolved.apiKey,\n      });';
if (content.includes(oldPollBody)) {
  content = content.replace(oldPollBody, '      if (input.taskId.startsWith("operations/") || input.taskId.includes("/operations/")) {\n        return await pollGeminiVideo(input.taskId);\n      }\n      const resolved = await resolveFeatureConfig(ctx.db, ctx.practiceId, "videoGeneration");\n      return await pollAlibabaVideo(input.taskId, { baseUrl: resolved.baseUrl, apiKey: resolved.apiKey });');
  console.log('poll updated');
} else { console.log('poll body not found'); }
fs.writeFileSync(path, content, 'utf8');
console.log('Done, length: ' + content.length);