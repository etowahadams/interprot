import click

from interprot.oned_probe.all_latents import all_latents
from interprot.oned_probe.single_latent import single_latent


@click.group()
def cli():
    """A tool for running logistic regression probes on SAE latents"""
    pass


cli.add_command(single_latent)
cli.add_command(all_latents)

if __name__ == "__main__":
    cli()
