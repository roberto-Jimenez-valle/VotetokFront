<script lang="ts">
    import { ArrowLeft, FileText, Shield, Cookie, Scale } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { onMount } from "svelte";

    // Versión actual de los documentos legales
    export const LEGAL_VERSION = "1.0.0";
    export const LEGAL_DATE = "24 de diciembre de 2024";

    type TabId = "aviso-legal" | "privacidad" | "terminos" | "cookies";

    const tabs: { id: TabId; label: string; icon: typeof FileText }[] = [
        { id: "aviso-legal", label: "Aviso Legal", icon: Scale },
        { id: "privacidad", label: "Privacidad", icon: Shield },
        { id: "terminos", label: "Términos", icon: FileText },
        { id: "cookies", label: "Cookies", icon: Cookie },
    ];

    let activeTab: TabId = $state("aviso-legal");

    onMount(() => {
        // Detectar tab desde URL hash
        const hash = $page.url.hash.replace("#", "") as TabId;
        if (tabs.some((t) => t.id === hash)) {
            activeTab = hash;
        }
    });

    function setTab(tabId: TabId) {
        activeTab = tabId;
        window.location.hash = tabId;
    }

    function goBack() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            goto("/");
        }
    }
</script>

<svelte:head>
    <title>Documentos Legales | Voutop</title>
    <meta
        name="description"
        content="Aviso Legal, Política de Privacidad, Términos de Uso y Política de Cookies de Voutop"
    />
</svelte:head>

<div class="legal-page">
    <!-- Header -->
    <header class="legal-header">
        <button class="back-btn" onclick={goBack} aria-label="Volver">
            <ArrowLeft size={24} />
        </button>
        <h1>Documentos Legales</h1>
        <span class="version">v{LEGAL_VERSION}</span>
    </header>

    <!-- Tabs -->
    <nav class="tabs-nav">
        {#each tabs as tab}
            <button
                class="tab-btn"
                class:active={activeTab === tab.id}
                onclick={() => setTab(tab.id)}
            >
                <svelte:component this={tab.icon} size={18} />
                <span>{tab.label}</span>
            </button>
        {/each}
    </nav>

    <!-- Content -->
    <main class="legal-content">
        {#if activeTab === "aviso-legal"}
            <article class="legal-document">
                <h2>📄 Aviso Legal</h2>
                <p class="last-updated">Última actualización: {LEGAL_DATE}</p>

                <section>
                    <h3>Responsable de la plataforma</h3>
                    <ul>
                        <li><strong>Nombre:</strong> Roberto Jiménez Valle</li>
                        <li><strong>País:</strong> España</li>
                        <li>
                            <strong>Correo electrónico:</strong>
                            <a href="mailto:voutop.oficial@gmail.com"
                                >voutop.oficial@gmail.com</a
                            >
                        </li>
                    </ul>
                    <p>
                        El presente Aviso Legal regula el acceso y uso de la
                        plataforma Voutop, accesible a través de su sitio web y
                        aplicaciones móviles.
                    </p>
                </section>
            </article>
        {:else if activeTab === "privacidad"}
            <article class="legal-document">
                <h2>📄 Política de Privacidad</h2>
                <p class="last-updated">Última actualización: {LEGAL_DATE}</p>

                <section>
                    <h3>1. Responsable del tratamiento</h3>
                    <ul>
                        <li><strong>Nombre:</strong> Roberto Jiménez Valle</li>
                        <li>
                            <strong>Email:</strong>
                            <a href="mailto:voutop.oficial@gmail.com"
                                >voutop.oficial@gmail.com</a
                            >
                        </li>
                        <li><strong>País:</strong> España</li>
                    </ul>
                </section>

                <section>
                    <h3>2. Acceso sin registro</h3>
                    <p>
                        El acceso a determinados contenidos públicos de la
                        Plataforma puede realizarse sin necesidad de registro.
                    </p>
                    <p>
                        No obstante, para interactuar con la Plataforma (votar,
                        comentar, crear contenido, enviar mensajes u otras
                        acciones similares) es necesario registrarse y cumplir
                        los requisitos establecidos en estos documentos.
                    </p>
                </section>

                <section>
                    <h3>3. Datos personales tratados</h3>

                    <h4>Datos proporcionados por el usuario</h4>
                    <ul>
                        <li>Nombre de usuario</li>
                        <li>Dirección de correo electrónico</li>
                        <li>Imagen de perfil (avatar)</li>
                        <li>
                            Contenido generado por el usuario (encuestas,
                            opciones, comentarios, mensajes)
                        </li>
                        <li>Enlaces o iframes introducidos por el usuario</li>
                    </ul>
                    <p>
                        La autenticación se realiza mediante proveedores
                        externos (por ejemplo, Google). <strong
                            >Voutop no almacena contraseñas.</strong
                        >
                    </p>

                    <h4>Datos técnicos y de uso</h4>
                    <ul>
                        <li>Dirección IP</li>
                        <li>Información del dispositivo y navegador</li>
                        <li>Registros de actividad</li>
                        <li>Datos de uso de la plataforma</li>
                        <li>
                            Datos de geolocalización precisa, cuando el usuario
                            lo autoriza explícitamente
                        </li>
                    </ul>

                    <h4>Datos obtenidos de terceros</h4>
                    <p>
                        Cuando el usuario introduce enlaces o iframes, la
                        Plataforma puede obtener miniaturas (thumbnails),
                        títulos u otros metadatos desde servicios externos.
                    </p>
                </section>

                <section>
                    <h3>4. Finalidad del tratamiento</h3>
                    <p>Los datos personales se tratan para:</p>
                    <ul>
                        <li>
                            Prestar el servicio de encuestas y participación
                        </li>
                        <li>Gestionar cuentas de usuario</li>
                        <li>Mostrar contenido, resultados y métricas</li>
                        <li>Permitir interacciones entre usuarios</li>
                        <li>Moderar el uso de la plataforma</li>
                        <li>Analizar el uso y mejorar el servicio</li>
                        <li>Mostrar publicidad propia o de terceros</li>
                        <li>Cumplir obligaciones legales</li>
                    </ul>
                </section>

                <section>
                    <h3>5. Base legal del tratamiento</h3>
                    <ul>
                        <li>
                            Ejecución del servicio solicitado por el usuario
                        </li>
                        <li>Consentimiento del usuario</li>
                        <li>
                            Interés legítimo (seguridad, estadísticas, mejora
                            del servicio)
                        </li>
                        <li>Cumplimiento de obligaciones legales</li>
                    </ul>
                </section>

                <section>
                    <h3>6. Edad mínima</h3>
                    <p>
                        <strong
                            >La Plataforma no está dirigida a menores de 16
                            años.</strong
                        >
                    </p>
                    <p>
                        Para registrarse e interactuar con la Plataforma es
                        necesario tener al menos 16 años. No recopilamos de
                        forma consciente datos personales de menores de dicha
                        edad.
                    </p>
                    <p>
                        Si se detecta que un usuario es menor de 16 años, su
                        cuenta y los datos asociados serán eliminados de forma
                        inmediata.
                    </p>
                </section>

                <section>
                    <h3>7. Conservación de los datos</h3>
                    <p>
                        Los datos se conservarán mientras la cuenta del usuario
                        permanezca activa.
                    </p>
                    <p>Al eliminar la cuenta:</p>
                    <ul>
                        <li>Se eliminarán los datos personales del usuario</li>
                        <li>
                            Se eliminará todo el contenido textual creado por el
                            usuario
                        </li>
                        <li>
                            Se eliminarán las encuestas creadas por el usuario
                        </li>
                        <li>
                            <strong
                                >Los votos se conservarán de forma anónima</strong
                            >
                        </li>
                    </ul>
                </section>

                <section>
                    <h3>8. Derechos del usuario</h3>
                    <p>
                        El usuario puede ejercer los derechos de <strong
                            >acceso, rectificación, supresión, oposición,
                            limitación y portabilidad</strong
                        >
                        mediante solicitud a
                        <a href="mailto:voutop.oficial@gmail.com"
                            >voutop.oficial@gmail.com</a
                        >.
                    </p>
                </section>

                <section>
                    <h3>9. Seguridad</h3>
                    <p>
                        Se aplican medidas técnicas y organizativas razonables
                        para proteger los datos personales.
                    </p>
                </section>
            </article>
        {:else if activeTab === "terminos"}
            <article class="legal-document">
                <h2>📄 Términos y Condiciones de Uso</h2>
                <p class="last-updated">Última actualización: {LEGAL_DATE}</p>

                <section>
                    <h3>1. Objeto</h3>
                    <p>
                        Voutop es una plataforma digital que permite visualizar
                        contenido público y, previa creación de una cuenta,
                        participar en encuestas y votaciones.
                    </p>
                </section>

                <section>
                    <h3>2. Acceso a la Plataforma</h3>
                    <p>
                        El acceso a contenido público puede realizarse sin
                        registro.
                    </p>
                    <p>
                        Para interactuar con la Plataforma (incluyendo, entre
                        otros, votar, comentar, crear encuestas, crear opciones,
                        enviar mensajes o seguir a otros usuarios) <strong
                            >es obligatorio registrarse</strong
                        >.
                    </p>
                </section>

                <section>
                    <h3>3. Requisito de edad</h3>
                    <p>
                        <strong
                            >El uso de las funcionalidades de interacción está
                            limitado a personas mayores de 16 años.</strong
                        >
                    </p>
                    <p>
                        El usuario declara y garantiza que cumple este
                        requisito.
                    </p>
                </section>

                <section>
                    <h3>4. Registro</h3>
                    <p>
                        El registro se realiza mediante sistemas de
                        autenticación externa.
                    </p>
                    <p>
                        Durante el registro o antes de la primera interacción,
                        el usuario deberá:
                    </p>
                    <ul>
                        <li>Declarar que tiene al menos 16 años</li>
                        <li>
                            Aceptar los Términos y Condiciones y la Política de
                            Privacidad
                        </li>
                    </ul>
                </section>

                <section>
                    <h3>5. Contenido generado por el usuario</h3>
                    <p>
                        El usuario es el único responsable del contenido que
                        publica, incluyendo textos, enlaces, iframes,
                        comentarios y mensajes.
                    </p>
                    <p><strong>Queda prohibido publicar:</strong></p>
                    <ul>
                        <li>Datos personales propios o de terceros</li>
                        <li>Contenido ilegal, ofensivo o sensible</li>
                        <li>Contenido que vulnere derechos de terceros</li>
                    </ul>
                </section>

                <section>
                    <h3>6. Eliminación de cuenta</h3>
                    <p>
                        El usuario puede eliminar su cuenta en cualquier
                        momento.
                    </p>
                    <p>Al hacerlo:</p>
                    <ul>
                        <li>Se eliminarán sus datos personales</li>
                        <li>
                            Se eliminará todo el contenido textual creado por el
                            usuario
                        </li>
                        <li>
                            Se eliminarán las encuestas creadas por el usuario,
                            incluso si otros usuarios han participado
                        </li>
                        <li>
                            <strong
                                >Los votos se conservarán de forma anónima</strong
                            >
                        </li>
                    </ul>
                </section>

                <section>
                    <h3>7. Moderación</h3>
                    <p>
                        Voutop se reserva el derecho de eliminar contenido,
                        limitar funcionalidades o suspender cuentas cuando sea
                        necesario para cumplir la ley o proteger la Plataforma y
                        a sus usuarios.
                    </p>
                </section>

                <section>
                    <h3>8. Contenido externo</h3>
                    <p>
                        La Plataforma puede mostrar contenido de terceros
                        mediante enlaces o iframes. Voutop no controla ni se
                        responsabiliza del contenido, disponibilidad o legalidad
                        de dichos servicios externos.
                    </p>
                </section>

                <section>
                    <h3>9. Publicidad</h3>
                    <p>
                        La Plataforma puede mostrar publicidad propia o de
                        terceros, incluida publicidad personalizada conforme a
                        la normativa aplicable.
                    </p>
                </section>

                <section>
                    <h3>10. Legislación aplicable</h3>
                    <p>
                        La relación entre el usuario y la Plataforma se rige por
                        la <strong>legislación española y europea</strong>.
                    </p>
                </section>
            </article>
        {:else if activeTab === "cookies"}
            <article class="legal-document">
                <h2>📄 Política de Cookies</h2>
                <p class="last-updated">Última actualización: {LEGAL_DATE}</p>

                <section>
                    <h3>¿Qué son las cookies?</h3>
                    <p>
                        Las cookies son pequeños archivos de texto que se
                        almacenan en tu dispositivo cuando visitas un sitio web.
                        Permiten que el sitio recuerde tus acciones y
                        preferencias.
                    </p>
                </section>

                <section>
                    <h3>Cookies que utilizamos</h3>
                    <p>Voutop utiliza cookies y tecnologías similares para:</p>
                    <ul>
                        <li>
                            <strong
                                >Garantizar el funcionamiento del sitio</strong
                            > (cookies esenciales)
                        </li>
                        <li>
                            <strong>Analizar el uso de la Plataforma</strong> (cookies
                            analíticas)
                        </li>
                        <li>
                            <strong>Mostrar publicidad</strong> (cookies publicitarias)
                        </li>
                    </ul>
                </section>

                <section>
                    <h3>Tipos de cookies</h3>

                    <h4>🔒 Cookies esenciales (obligatorias)</h4>
                    <p>
                        Son necesarias para el funcionamiento básico del sitio.
                        Incluyen:
                    </p>
                    <ul>
                        <li>Cookies de sesión y autenticación</li>
                        <li>Preferencias de usuario (idioma, tema)</li>
                        <li>Seguridad y prevención de fraude</li>
                    </ul>

                    <h4>📊 Cookies analíticas (opcionales)</h4>
                    <p>
                        Nos ayudan a entender cómo los usuarios interactúan con
                        la plataforma:
                    </p>
                    <ul>
                        <li>Páginas visitadas</li>
                        <li>Tiempo de navegación</li>
                        <li>Errores encontrados</li>
                    </ul>

                    <h4>🎯 Cookies publicitarias (opcionales)</h4>
                    <p>Se utilizan para mostrar anuncios relevantes:</p>
                    <ul>
                        <li>Publicidad personalizada</li>
                        <li>Medición de campañas</li>
                        <li>Remarketing</li>
                    </ul>
                </section>

                <section>
                    <h3>Gestionar tus preferencias</h3>
                    <p>
                        El usuario puede configurar o rechazar las cookies a
                        través de:
                    </p>
                    <ul>
                        <li>
                            El banner de cookies que aparece al visitar el sitio
                        </li>
                        <li>La configuración de tu navegador</li>
                        <li>La sección de Ajustes de tu cuenta</li>
                    </ul>
                    <p>
                        <strong>Nota:</strong> Rechazar las cookies esenciales puede
                        afectar al funcionamiento de la plataforma.
                    </p>
                </section>
            </article>
        {/if}
    </main>

    <!-- Footer -->
    <footer class="legal-footer">
        <p>
            © {new Date().getFullYear()} Voutop. Todos los derechos reservados.
        </p>
        <p>
            Contacto: <a href="mailto:voutop.oficial@gmail.com"
                >voutop.oficial@gmail.com</a
            >
        </p>
    </footer>
</div>

<style>
    .legal-page {
        min-height: 100vh;
        background: linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%);
        padding-bottom: env(safe-area-inset-bottom, 20px);
    }

    :global(html.dark) .legal-page {
        background: linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%);
    }

    /* Header */
    .legal-header {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px 20px;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        position: sticky;
        top: 0;
        z-index: 100;
    }

    :global(html.dark) .legal-header {
        background: rgba(26, 26, 46, 0.9);
        border-bottom-color: rgba(255, 255, 255, 0.05);
    }

    .back-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.05);
        color: #333;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .back-btn:hover {
        background: rgba(0, 0, 0, 0.1);
        transform: scale(1.05);
    }

    :global(html.dark) .back-btn {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
    }

    :global(html.dark) .back-btn:hover {
        background: rgba(255, 255, 255, 0.15);
    }

    .legal-header h1 {
        flex: 1;
        font-size: 20px;
        font-weight: 700;
        color: #1a1a2e;
        margin: 0;
    }

    :global(html.dark) .legal-header h1 {
        color: #fff;
    }

    .version {
        font-size: 12px;
        color: #888;
        background: rgba(139, 92, 246, 0.1);
        padding: 4px 8px;
        border-radius: 12px;
    }

    /* Tabs */
    .tabs-nav {
        display: flex;
        gap: 8px;
        padding: 16px 20px;
        overflow-x: auto;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
    }

    .tabs-nav::-webkit-scrollbar {
        display: none;
    }

    .tab-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        border: none;
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.05);
        color: #666;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
    }

    .tab-btn:hover {
        background: rgba(139, 92, 246, 0.1);
        color: #8b5cf6;
    }

    .tab-btn.active {
        background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
        color: #fff;
        box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
    }

    :global(html.dark) .tab-btn {
        background: rgba(255, 255, 255, 0.05);
        color: #aaa;
    }

    :global(html.dark) .tab-btn:hover {
        background: rgba(139, 92, 246, 0.2);
    }

    /* Content */
    .legal-content {
        padding: 0 20px;
        max-width: 800px;
        margin: 0 auto;
    }

    .legal-document {
        background: #fff;
        border-radius: 20px;
        padding: 24px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        margin-bottom: 24px;
    }

    :global(html.dark) .legal-document {
        background: rgba(255, 255, 255, 0.03);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }

    .legal-document h2 {
        font-size: 24px;
        font-weight: 700;
        color: #1a1a2e;
        margin: 0 0 8px;
    }

    :global(html.dark) .legal-document h2 {
        color: #fff;
    }

    .last-updated {
        font-size: 13px;
        color: #888;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    :global(html.dark) .last-updated {
        border-bottom-color: rgba(255, 255, 255, 0.05);
    }

    .legal-document section {
        margin-bottom: 24px;
    }

    .legal-document section:last-child {
        margin-bottom: 0;
    }

    .legal-document h3 {
        font-size: 18px;
        font-weight: 600;
        color: #1a1a2e;
        margin: 0 0 12px;
    }

    :global(html.dark) .legal-document h3 {
        color: #e0e0e0;
    }

    .legal-document h4 {
        font-size: 15px;
        font-weight: 600;
        color: #444;
        margin: 16px 0 8px;
    }

    :global(html.dark) .legal-document h4 {
        color: #bbb;
    }

    .legal-document p {
        font-size: 15px;
        line-height: 1.7;
        color: #555;
        margin: 0 0 12px;
    }

    :global(html.dark) .legal-document p {
        color: #aaa;
    }

    .legal-document ul {
        margin: 0 0 12px;
        padding-left: 24px;
    }

    .legal-document li {
        font-size: 15px;
        line-height: 1.7;
        color: #555;
        margin-bottom: 6px;
    }

    :global(html.dark) .legal-document li {
        color: #aaa;
    }

    .legal-document a {
        color: #8b5cf6;
        text-decoration: none;
    }

    .legal-document a:hover {
        text-decoration: underline;
    }

    .legal-document strong {
        color: #1a1a2e;
    }

    :global(html.dark) .legal-document strong {
        color: #fff;
    }

    /* Footer */
    .legal-footer {
        text-align: center;
        padding: 24px 20px;
        border-top: 1px solid rgba(0, 0, 0, 0.05);
        margin-top: 24px;
    }

    :global(html.dark) .legal-footer {
        border-top-color: rgba(255, 255, 255, 0.05);
    }

    .legal-footer p {
        font-size: 13px;
        color: #888;
        margin: 4px 0;
    }

    .legal-footer a {
        color: #8b5cf6;
        text-decoration: none;
    }

    .legal-footer a:hover {
        text-decoration: underline;
    }

    /* Responsive */
    @media (max-width: 640px) {
        .legal-header {
            padding: 12px 16px;
        }

        .legal-header h1 {
            font-size: 18px;
        }

        .tabs-nav {
            padding: 12px 16px;
        }

        .tab-btn {
            padding: 8px 12px;
            font-size: 13px;
        }

        .legal-content {
            padding: 0 16px;
        }

        .legal-document {
            padding: 20px 16px;
        }

        .legal-document h2 {
            font-size: 20px;
        }

        .legal-document h3 {
            font-size: 16px;
        }

        .legal-document p,
        .legal-document li {
            font-size: 14px;
        }
    }
</style>
