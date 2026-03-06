import { useRef, useState, useEffect, useCallback, ChangeEvent } from "react";
import { Plus, Search, Sparkles, Loader2, Copy, MessageSquare, AlertTriangle, CheckCircle2, Landmark, FileText, Download, Eye, Trash2, Calendar, User, MapPin, Phone, Mic, ImagePlus, X, FileAudio, Image, Pencil, Upload, CloudUpload, Paperclip, Lightbulb, ArrowRight, Video, FileUp, Undo2, Redo2 } from "lucide-react";
import PreviewFormatToolbar, { FormatOptions, defaultFormatOptions } from "@/components/PreviewFormatToolbar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import OficioPreview from "@/components/OficioPreview";
import { exportToWord, exportToPDF } from "@/lib/exportOficio";
import ImageUploader from "@/components/ImageUploader";
import RichTextEditor from "@/components/RichTextEditor";
import FileDropzone from "@/components/FileDropzone";
import type { DemandaAnexo } from "@/types";
import logoCamara from "@/assets/logo-camara.png";
import logoFabao from "@/assets/logo-fabao.png";
import assinaturaFabao from "@/assets/assinatura-fabao.png";


              {/* Multi-file media upload zone */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                  <FileUp size={12} /> Anexar Mídias (imagens, áudios, vídeos)
                </label>
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*,audio/*,video/*"
                  multiple
                  className="hidden"
                  onChange={e => e.target.files && handleMultiFileUpload(e.target.files)}
                />
                <div
                  onClick={() => mediaInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={e => { e.preventDefault(); e.stopPropagation(); handleMultiFileUpload(e.dataTransfer.files); }}
                  className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center justify-center gap-3 text-muted-foreground">
                    <ImagePlus size={18} />
                    <Mic size={18} />
                    <Video size={18} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Arraste ou clique para adicionar fotos, áudios ou vídeos
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    Múltiplos arquivos simultâneos · A IA extrai e combina as informações
                  </p>
                </div>
              </div>

              {/* Processing queue */}
              {processingQueue.length > 0 && (
                <div className="space-y-1.5">
                  {processingQueue.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary text-sm">
                      {item.type === "image" ? <Image size={14} /> : item.type === "video" ? <Video size={14} /> : <FileAudio size={14} />}
                      <span className="flex-1 truncate text-xs text-foreground">{item.file.name}</span>
                      {item.status === "pending" && <span className="text-[10px] text-muted-foreground">Aguardando...</span>}
                      {item.status === "processing" && <Loader2 size={14} className="animate-spin text-primary" />}
                      {item.status === "done" && <CheckCircle2 size={14} className="text-primary" />}
                      {item.status === "error" && <AlertTriangle size={14} className="text-destructive" />}
                    </div>
                  ))}
                </div>
              )}

              {/* Processed results preview */}
              {processedResults.length > 0 && !isProcessingFiles && (
                <div className="space-y-2 p-3 bg-accent/30 rounded-lg border border-accent">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-primary" />
                      {processedResults.length} arquivo(s) processado(s)
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setProcessedResults([]); setProcessingQueue([]); }}>
                      <X size={14} />
                    </Button>
                  </div>
                  {processedResults.map((r, i) => (
                    <div key={i} className="bg-background/50 p-2 rounded border border-border">
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {r.type === "image" ? "📷" : r.type === "video" ? "🎬" : "🎤"} {r.fileName}
                      </span>
                      <div className="max-h-[80px] overflow-y-auto text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                        {r.text.slice(0, 300)}{r.text.length > 300 ? "…" : ""}
                      </div>
                    </div>
                  ))}
                  <Button size="sm" onClick={confirmAllProcessedTexts} className="w-full bg-primary text-primary-foreground">
                    <CheckCircle2 size={14} className="mr-1" /> Inserir tudo na descrição
                  </Button>
                </div>
              )}

              {/* Linha Telefônica */}
              {userPhones.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1"><Phone size={12} /> Linha Telefônica utilizada</label>
                  <Select value={linhaTelefonica} onValueChange={setLinhaTelefonica}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione a linha..." /></SelectTrigger>
                    <SelectContent>
                      {userPhones.map((phone, i) => <SelectItem key={i} value={phone}>Linha {i + 1}: {phone}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridade</label>
                <Select value={prioridade} onValueChange={setPrioridade}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ImageUploader images={anexoImages} onChange={setAnexoImages} />

              <div className="flex gap-2">
                <Button onClick={handleGenerateAI} disabled={isGenerating} className="flex-1 bg-primary text-primary-foreground">
                  {isGenerating ? <><Loader2 size={16} className="mr-2 animate-spin" /> Gerando...</> : <><Sparkles size={16} className="mr-2" /> Gerar Texto com IA</>}
                </Button>
                <Button variant="outline" onClick={handleCreate} className="border-border">
                  Salvar Rascunho
                </Button>
              </div>
            </TabsContent>

            {/* TAB: TEXTO */}
            <TabsContent value="texto" className="space-y-4 mt-4">
              {aiResult && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {aiResult.secretaria_identificada && (
                    <span className="text-xs px-3 py-1 rounded-full bg-primary/20 text-primary flex items-center gap-1"><Landmark size={12} /> {aiResult.secretaria_identificada}</span>
                  )}
                  {aiResult.tipo_demanda && <span className="text-xs px-3 py-1 rounded-full bg-accent text-accent-foreground">{aiResult.tipo_demanda}</span>}
                  {aiResult.urgencia && (
                    <span className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 ${aiResult.urgencia === "urgente" ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}>
                      {aiResult.urgencia === "urgente" ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                      {aiResult.urgencia === "urgente" ? "Urgente" : "Normal"}
                    </span>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground">Texto do Ofício</label>
                  <div className="flex gap-1 items-center">
                    <Button variant="ghost" size="sm" onClick={undoOficio} disabled={historyIndex <= 0} title="Desfazer (Ctrl+Z)">
                      <Undo2 size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={redoOficio} disabled={historyIndex >= oficioHistory.length - 1} title="Refazer (Ctrl+Y)">
                      <Redo2 size={14} />
                    </Button>
                    {oficioHistory.length > 1 && (
                      <span className="text-[10px] text-muted-foreground mx-1">
                        v{historyIndex + 1}/{oficioHistory.length}
                      </span>
                    )}
                    {editedOficio && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(htmlToPlain(editedOficio), "Ofício")}><Copy size={14} className="mr-1" /> Copiar</Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { handleOficioChange(""); }}><Trash2 size={14} className="mr-1" /> Limpar</Button>
                      </>
                    )}
                  </div>
                </div>
                <RichTextEditor
                  content={editedOficio.startsWith("<") ? editedOficio : plainToHtml(editedOficio)}
                  onChange={(html) => handleOficioChange(html)}
                  placeholder="O texto será preenchido pela IA ou manualmente..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MessageSquare size={12} /> Resposta ao Cidadão</label>
                  {editedResposta && <Button variant="ghost" size="sm" onClick={() => copyToClipboard(editedResposta, "Resposta")}><Copy size={14} className="mr-1" /> Copiar</Button>}
                </div>
                <Textarea value={editedResposta} onChange={e => setEditedResposta(e.target.value)} placeholder="Sugestão de resposta ao cidadão..." className="bg-secondary border-border min-h-[150px] text-sm" />
              </div>

              {/* Anexos inline */}
              <div>
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                  <Paperclip size={12} /> Anexos do Ofício
                </label>
                <FileDropzone
                  anexos={anexos}
                  onChange={setAnexos}
                  onFileAdded={(file) => {
                    // Auto-process PDFs/images for text extraction
                    if (file.type === "application/pdf" || file.type.startsWith("image/")) {
                      const type = file.type.startsWith("image/") ? "image" : "audio";
                      // Could trigger analysis here if needed
                    }
                  }}
                />
              </div>

              {aiResult?.sugestoes_melhoria?.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">💡 Sugestões de melhoria</label>
                  {aiResult.sugestoes_melhoria.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-secondary rounded-lg">
                      <span className="text-primary mt-0.5">💡</span>
                      <p className="text-sm text-foreground">{s}</p>
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground">
                <CheckCircle2 size={16} className="mr-1" /> Salvar Ofício
              </Button>
            </TabsContent>

            {/* TAB: PREVIEW */}
            <TabsContent value="preview" className="space-y-3 mt-4">
              <PreviewFormatToolbar options={formatOptions} onChange={setFormatOptions} />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => {
                  if (!destinatario || !assunto || !editedOficio) {
                    alert("Preencha o destinatário, assunto e gere o texto do ofício antes de exportar.");
                    return;
                  }
                  exportToWord(buildFormExportData());
                }}>
                  <FileText size={14} className="mr-1" /> Word
                </Button>
                <Button size="sm" variant="outline" onClick={async () => { await exportToPDF(buildFormExportData()); }}>
                  <Download size={14} className="mr-1" /> PDF
                </Button>
              </div>
              <div className="overflow-x-auto border border-border rounded-lg" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                <OficioPreview ref={previewRef} numero={numero} destinatario={destinatario} assunto={assunto} conteudo={editedOficio} cargoDestinatario={cargoDestinatario} operadorNome={user?.user_metadata?.full_name || user?.email || undefined} formatOptions={formatOptions} editable onContentChange={setEditedOficio} initialConteudo={originalOficio} />
              </div>
            </TabsContent>

            {/* TAB: STATUS */}
            <TabsContent value="status" className="space-y-4 mt-4">
              <div className="bg-secondary rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Informações do Ofício</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Número:</span> <span className="text-foreground">{numero || "—"}</span></div>
                  <div><span className="text-muted-foreground">Data:</span> <span className="text-foreground">{dataGeracao}</span></div>
                  <div><span className="text-muted-foreground">Assunto:</span> <span className="text-foreground">{assunto || "—"}</span></div>
                  <div><span className="text-muted-foreground">Destinatário:</span> <span className="text-foreground">{destinatario || "—"}</span></div>
                  <div><span className="text-muted-foreground">Secretaria:</span> <span className="text-foreground">{secretaria || "—"}</span></div>
                  <div><span className="text-muted-foreground">Prioridade:</span> <span className="text-foreground">{prioridade}</span></div>
                  <div><span className="text-muted-foreground">Solicitante:</span> <span className="text-foreground">{solicitante || "—"}</span></div>
                  <div><span className="text-muted-foreground">Bairro:</span> <span className="text-foreground">{bairro || "—"}</span></div>
                </div>
                {aiResult && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-primary flex items-center gap-1"><Sparkles size={12} /> Gerado por IA</p>
                  </div>
                )}
              </div>
              <Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground">
                <CheckCircle2 size={16} className="mr-1" /> {editingOficioId ? "Atualizar Ofício" : "Salvar Ofício"}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="bg-card border-border !max-w-[100vw] !w-[100vw] !h-[100vh] !max-h-[100vh] !rounded-none !top-0 !left-0 !translate-x-0 !translate-y-0 overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center justify-between">
              <span>{viewingOficio?.assunto || "Ofício"}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  if (viewingOficio?.conteudo) exportToWord(buildExportData(viewingOficio));
                }}><FileText size={14} className="mr-1" /> Word</Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  if (viewingOficio?.conteudo) await exportToPDF(buildExportData(viewingOficio));
                }}><Download size={14} className="mr-1" /> PDF</Button>
                <Button size="sm" variant="outline" disabled={isUploading} onClick={() => { if (viewingOficio) handleUploadToDrive(viewingOficio); }}>
                  {isUploading ? <Loader2 size={14} className="mr-1 animate-spin" /> : <CloudUpload size={14} className="mr-1" />} Drive
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Visualize o conteúdo antes de exportar para Word ou PDF.</DialogDescription>
          </DialogHeader>
          {viewingOficio && (
            <div className="flex justify-center">
              <div id="oficio-view-preview" className="shadow-lg">
                <OficioPreview numero={viewingOficio.numero || ""} destinatario={viewingOficio.destinatario} assunto={viewingOficio.assunto} conteudo={viewingOficio.conteudo || ""} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
