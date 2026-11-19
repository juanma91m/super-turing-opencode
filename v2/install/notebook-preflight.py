#!/usr/bin/env python3
"""Bounded notebook inventory; no OpenCode launch, DB opens, config dump or writes.

Python 3.8+ so that older machines can diagnose before running the newer updater.
This is not installation approval: owner selectors still validate complete wiring.
"""
import argparse
import json
import os
from pathlib import Path
import platform
import pwd
import re
import shutil
import subprocess
import sys
import tempfile


GUIDANCE = {
    "published-runtime-requires-linux-x86_64": "Este paquete está fijado para Linux x86_64. No instalarlo en otra plataforma ni sustituir el pin: hace falta un port revisado.",
    "updater-needs-python-3.9-or-newer": "Seleccionar Python 3.9+ para el updater (el inventario admite 3.8). No reemplazar el Python del sistema a ciegas; repetir el diagnóstico con el intérprete compatible.",
    "node-missing-or-incompatible": "Instalar/seleccionar Node 22.22.2+, 24.15+ o 26+ mediante el gestor de runtimes de esta notebook. No reemplazar runtimes de aplicaciones ni bajar el pin para pasar el check.",
    "missing-git": "Instalar Git mediante el gestor de paquetes de esta notebook; no resetear repos existentes.",
    "missing-npm": "Preparar npm con el Node compatible seleccionado; no ejecutar el instalador V1 --complete.",
    "missing-corepack": "Preparar Corepack compatible con el Node seleccionado: Artifact Studio requiere su lockfile pnpm. No instalar dependencias con latest para eludir el lock.",
    "missing-bwrap": "Instalar Bubblewrap y comprobar que la notebook permite namespaces de usuario. No ejecutar la migración sin aislamiento como fallback.",
    "background-owner-cutover-required": "El runtime aún pertenece a Background. Conservar binario, ownership y backup original. Un agente local debe preparar un corte/rollback propio de esta notebook con el lifecycle del owner; no borrar el marker ni copiar el plan fechado de otra PC. El updater general no automatiza este caso.",
    "background-marker-needs-review": "Hay ownership Background no reconocido. Revisarlo localmente sin copiar credenciales. No borrar o editar el marker para aparentar que está libre.",
    "official-legacy-history-conversion-or-explicit-path-required": "Si hay historial JSON, preparar conversión oficial de OpenCode en una copia, con backup y cotejo de sesiones. Si el SQLite existe en otra ruta, seleccionarlo explícitamente con --history-db en el updater. No crear una DB vacía ni copiar la de otra computadora.",
    "mixed-sqlite-and-json-history-review-required": "Coexisten SQLite e historial JSON. Un agente local debe determinar si el SQLite contiene toda la historia antes de seleccionarlo. No fusionar por SQL, borrar JSON ni asumir que está migrado.",
}


def next_steps(result):
    blockers = result["earlyBlockers"]
    lines = ["# Continuación local de la actualización", "",
             "No hace falta pegar este resultado en otra conversación ni volver a la PC original.",
             "El diagnóstico contiene metadata, no cuerpos de bases, configuración resuelta o credenciales.", "",
             "## Resultado", "",
             "**DETENIDO: resolver los puntos siguientes antes de actualizar.**" if blockers else
             "**Sin bloqueos tempranos: pasar al plan del owner, NO es aprobación de instalación.**", ""]
    for code in blockers:
        lines += ["### " + code, "", GUIDANCE.get(code, "Caso no reconocido: revisar localmente sin forzar la instalación."), ""]
    lines += ["## Si no hay bloqueos tempranos", "",
              "1. Para AUNE/productos, usar un checkout nuevo y actual del owner privado y ejecutar `bash v2/update.sh plan --home \"$HOME\"`. No usar el updater portable para omitir la capa privada.",
              "2. Revisar stores seleccionados, espacio, runtimes y configuración. Plan no valida todo el builder.",
              "3. Cerrar clientes OpenCode, Engram y procesos de sync. Sólo entonces ejecutar el update del owner con `--clients-closed` y la cuenta GitHub local explícita.", "",
              "## Si el intento de actualización falla después", "",
              "- Stores abiertos / lease: cerrar clientes de forma normal. No matar procesos ni quitar locks por reflejo.",
              "- Selección ambigua: usar rutas explícitas de ESTA notebook para historial/Engram/corpus, verificando el wiring; no inicializar reemplazos.",
              "- Fuentes privadas / autenticación: autenticar la cuenta correspondiente en la notebook; no copiar tokens ni cambiar silenciosamente la cuenta global.",
              "- Espacio insuficiente: elegir `--destination` en un volumen durable con espacio para backups y copias. No borrar los datos originales para hacer lugar.",
              "- Fallo de builder, runtime, wiring o drift: conservar generación, `failure.json`, `build-spec.json`, fuentes y backups. Reconciliar ese owner localmente, sin --complete V1, chmods amplios ni recortes de guardas.",
              "- Fallo tras publicar: inspeccionar recibos/marker y cerrar clientes; usar el rollback documentado sólo si sus verificaciones lo aceptan. Nunca restaurar una DB vieja sobre conversaciones nuevas.",
              "- Context7 sin cuota / Rovo intermitente: son incidencias aparte. No relajar readiness ni credenciales para ocultarlas.", "",
              "## Handoff para el agente que uses en esta notebook", "",
              "Leer este archivo, `diagnostic.json`, `attempt.json` si existe y `v2/install/NOTEBOOK.md` del Core descargado. Identificar el owner y el layout real; preparar backups verificados y migración oficial en copia. Preservar historial, snapshots, Engram, corpus, configuración y trabajo Git. No copiar rutas/credenciales/planes machine-local de otra PC. Resolver primero los bloqueos y validar antes de publicar la entrada. Si un caso no está soportado, mantener la instalación anterior intacta.", "",
              "La migración de un layout antiguo desconocido NO está automatizada por este diagnóstico.", ""]
    return "\n".join(lines)


def save_report(home, result):
    parent = home / ".local/state/opencode-stack/install/diagnostics"
    if not physical(parent):
        raise ValueError("Physical diagnostic directory required")
    parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if parent.stat().st_uid != os.getuid() or parent.stat().st_mode & 0o077:
        raise ValueError("Private user-owned diagnostic directory required")
    directory = Path(tempfile.mkdtemp(prefix="attempt-", dir=str(parent)))
    for name, text in [("diagnostic.json", json.dumps(result, indent=2) + "\n"), ("NEXT-STEPS.md", next_steps(result))]:
        with open(directory / name, "x", opener=lambda path, flags: os.open(path, flags, 0o600)) as stream:
            stream.write(text)
    return directory


def physical(path):
    return path.is_absolute() and not any(p.is_symlink() for p in [path] + list(path.parents))


def metadata(path):
    if not physical(path):
        return {"present": path.exists() or path.is_symlink(), "symlinkedPath": True}
    if not path.exists():
        return {"present": False}
    stat = path.stat()
    return {"present": True, "directory": path.is_dir(), "bytes": stat.st_size if path.is_file() else None}


def node_version(home):
    binary = shutil.which("node")
    if not binary:
        return {"present": False, "compatible": False}
    env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": str(home), "LANG": "C.UTF-8"}
    try:
        run = subprocess.run([binary, "--version"], cwd=home, env=env, stdin=subprocess.DEVNULL,
                             stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=10, universal_newlines=True)
        match = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)\s*", run.stdout) if run.returncode == 0 else None
    except (OSError, subprocess.SubprocessError):
        match = None
    if not match:
        return {"present": True, "compatible": False, "version": "unavailable"}
    major, minor, patch = map(int, match.groups())
    compatible = (major == 22 and (minor, patch) >= (22, 2) or
                  major == 24 and (minor, patch) >= (15, 0) or major >= 26)
    return {"present": True, "version": ".".join(match.groups()), "compatible": compatible}


def inspect(home, history=None):
    if not physical(home) or not home.is_dir():
        raise ValueError("Existing physical absolute HOME required")
    paths = {
        "legacySQLite": home / ".local/share/opencode/opencode.db",
        "legacyJSONSessions": home / ".local/share/opencode/storage/session",
        "productionV2Settings": home / ".config/opencode/production-v2/settings.json",
        "updaterGeneration": home / ".local/state/opencode-stack/install/current.json",
        "engramDefault": home / ".engram/engram.db",
        "engramAlternate": home / ".local/share/engram/engram.db",
        "corpusDefault": home / ".local/share/super-turing-opencode-knowledge/qdrant",
        "backgroundOwnershipMarker": home / ".opencode/.opencode-background-addon.json",
    }
    inventory = {key: metadata(path) for key, path in paths.items()}
    if history is not None:
        inventory["explicitHistory"] = metadata(history)
    blocked = []
    if platform.system() != "Linux" or platform.machine() != "x86_64":
        blocked.append("published-runtime-requires-linux-x86_64")
    node = node_version(home)
    tools = {name: shutil.which(name) is not None for name in ["git", "npm", "corepack", "bwrap", "gh"]}
    if sys.version_info < (3, 9):
        blocked.append("updater-needs-python-3.9-or-newer")
    if not node["compatible"]:
        blocked.append("node-missing-or-incompatible")
    for name in ["git", "npm", "corepack", "bwrap"]:
        if not tools[name]:
            blocked.append("missing-" + name)
    marker = paths["backgroundOwnershipMarker"]
    mode = "absent"
    if inventory["backgroundOwnershipMarker"].get("present"):
        mode = "unreviewed"
        if physical(marker) and marker.is_file() and marker.stat().st_size <= 65536:
            try:
                if json.loads(marker.read_text()).get("mode") == "managed-local-install":
                    mode = "managed-local-install"
            except (ValueError, OSError, AttributeError):
                pass
        if mode == "managed-local-install":
            blocked.append("background-owner-cutover-required")
        else:
            blocked.append("background-marker-needs-review")
    v2 = inventory["productionV2Settings"].get("present") or inventory["updaterGeneration"].get("present")
    explicit_history = inventory.get("explicitHistory", {}).get("present") and not inventory["explicitHistory"].get("symlinkedPath") and inventory["explicitHistory"].get("directory") is False
    if not v2 and not inventory["legacySQLite"].get("present") and not explicit_history:
        blocked.append("official-legacy-history-conversion-or-explicit-path-required")
    if not v2 and inventory["legacySQLite"].get("present") and inventory["legacyJSONSessions"].get("present") and not explicit_history:
        blocked.append("mixed-sqlite-and-json-history-review-required")
    return {"kind": "notebook-readonly-diagnostic", "schemaVersion": 1,
            "platform": {"system": platform.system(), "machine": platform.machine()},
            "python": ".".join(map(str, sys.version_info[:3])), "node": node, "toolsPresent": tools,
            "knownPaths": inventory, "backgroundMode": mode,
            "homeVolumeFreeGiB": round(shutil.disk_usage(home).free / 1024**3, 2),
            "earlyBlockers": blocked, "installationApproved": False,
            "nextStep": "Review this metadata, then owner updater plan; no update on unknown layout",
            "scope": "Known default paths only; custom stores, addon runtimes and complete config not inspected",
            "openCodeLaunched": False, "databasesOpened": False, "writesPerformed": 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--home", type=Path, default=Path(pwd.getpwuid(os.getuid()).pw_dir))
    parser.add_argument("--save-report", action="store_true", help="Write private diagnostic metadata and NEXT-STEPS.md locally; never changes installation/data")
    args = parser.parse_args()
    try:
        result = inspect(args.home)
        if args.save_report:
            directory = save_report(args.home, result)
            result = {**result, "reportDirectory": str(directory), "nextStepsFile": str(directory / "NEXT-STEPS.md"), "diagnosticArtifactsWritten": 2}
        print(json.dumps(result, indent=2))
    except (OSError, ValueError):
        parser.exit(1, "Notebook inventory refused; check HOME/path permissions. No install or data changes performed.\n")


if __name__ == "__main__":
    main()
