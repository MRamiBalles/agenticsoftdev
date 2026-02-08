import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SddPhase, PHASE_CONFIG, SddDocument } from "@/types/sdd";
import ReactMarkdown from "react-markdown";

interface AgentChatProps {
  projectId: string;
  phase: SddPhase;
  documents: SddDocument[];
  onDocumentGenerated: (content: string) => void;
}

interface ChatMessage {
  role: "user" | "agent";
  content: string;
}

const AgentChat = ({ projectId, phase, documents, onDocumentGenerated }: AgentChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const config = PHASE_CONFIG[phase];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Load existing messages
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("sdd_agent_messages")
        .select("*")
        .eq("project_id", projectId)
        .eq("phase", phase)
        .order("created_at");
      if (data) {
        setMessages(
          (data as any[]).map((m) => ({
            role: m.role === "user" ? "user" as const : "agent" as const,
            content: m.content,
          }))
        );
      }
    };
    load();
  }, [projectId, phase]);

  const buildContext = () => {
    const ctx: Record<string, any> = {};
    // Include constitution if exists
    const constitution = documents.find((d) => d.doc_type === "constitution");
    if (constitution) ctx.constitution = constitution.content;

    // Include previous phase docs
    const prevDocs = documents.filter((d) => d.phase !== phase && d.status === "approved");
    if (prevDocs.length > 0) {
      ctx.previousDocs = prevDocs.map((d) => ({ title: d.title, content: d.content }));
    }
    return ctx;
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    // Save user message
    await supabase.from("sdd_agent_messages").insert({
      project_id: projectId,
      phase,
      role: "user",
      content: input,
    } as any);

    let assistantContent = "";
    const apiMessages = [...messages, userMsg].map((m) => ({
      role: m.role === "agent" ? "assistant" : "user",
      content: m.content,
    }));

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sdd-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action: "stream",
            phase,
            messages: apiMessages,
            context: buildContext(),
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const updateAssistant = (chunk: string) => {
        assistantContent += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "agent") {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: assistantContent } : m
            );
          }
          return [...prev, { role: "agent" as const, content: assistantContent }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save agent message
      if (assistantContent) {
        await supabase.from("sdd_agent_messages").insert({
          project_id: projectId,
          phase,
          role: "agent",
          content: assistantContent,
          agent_name: config.agent,
        } as any);

        // Check if the response contains a document (has markdown headers)
        if (assistantContent.includes("## ") || assistantContent.includes("# ")) {
          onDocumentGenerated(assistantContent);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Error al comunicarse con el agente");
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Bot className={`w-4 h-4 ${config.color === "accent" ? "text-accent" : "text-primary"}`} />
        <span className="text-sm font-semibold text-foreground">{config.agent}</span>
        <span className="text-[10px] text-muted-foreground font-mono ml-auto">
          {config.label}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Soy el <span className="text-foreground font-medium">{config.agent}</span>.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {config.description}. Cuéntame sobre tu proyecto.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "agent" && (
              <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-primary/10 border border-primary/20 text-foreground"
                  : "glass text-foreground"
              }`}
            >
              {msg.role === "agent" ? (
                <div className="prose prose-sm prose-invert max-w-none [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_p]:text-sm [&_li]:text-sm [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 mt-1">
                <User className="w-3.5 h-3.5 text-accent" />
              </div>
            )}
          </motion.div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== "agent" && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
            </div>
            <div className="glass rounded-lg px-4 py-3">
              <span className="text-sm text-muted-foreground animate-pulse">Pensando...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Habla con ${config.agent}...`}
            disabled={isStreaming}
            className="flex-1 px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AgentChat;
